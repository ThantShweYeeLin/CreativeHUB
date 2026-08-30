import { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { GoogleGenAI, Type, createUserContent, createPartFromBase64 } from '@google/genai';
import { z } from 'zod';

const router = Router();

// CreativeHUB's ONLY supported freelancer categories. This must be kept in
// sync by hand with src/lib/categories.ts's FREELANCER_CATEGORIES — this is
// a separately-built TS project (see server/tsconfig.json's rootDir) so it
// can't import that file directly. The AI Matcher must never classify an
// image into anything outside this fixed list.
const TAXONOMY: Record<string, string[]> = {
  'Photographer': ['Cinematic', 'Bright & Airy', 'Moody', 'Vintage', 'Editorial', 'Minimalist', 'Natural', 'Luxury', 'Documentary'],
  'Makeup Artist': ['Douyin Makeup', 'Soft Glam', 'Natural Glam', 'Bridal Glam', 'Korean-Inspired', 'Chinese-Inspired', 'Glitter Makeup', 'Bold Glam', 'Minimal Makeup'],
  'Hair Stylist': ['Korean-Inspired', 'Elegant', 'Romantic', 'Y2K', 'Natural', 'Glamorous', 'Vintage', 'Modern', 'Bridal'],
  'Fashion Designer': ['Minimalist', 'Elegant', 'Luxury', 'Vintage', 'Traditional', 'Modern', 'Romantic', 'Avant-Garde', 'Streetwear'],
  'Model': ['Editorial', 'Streetwear', 'Elegant', 'High Fashion', 'Commercial', 'Minimalist', 'Luxury', 'Casual', 'Beauty'],
};

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const uploadDirectory = path.join(os.tmpdir(), 'creativehub-ai-matcher');

const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new Error('Only JPG, PNG, WebP, and GIF images are supported.'));
      return;
    }

    callback(null, true);
  },
});

// A single generateContent attempt can, in practice, hang far longer than
// its 503/429 retry logic accounts for — Google's SDK never times an
// attempt out on its own. Race each attempt against this so a stuck call
// falls through to the next model/attempt instead of blocking the request
// (and the client's own timeout) for minutes.
const GENERATION_ATTEMPT_TIMEOUT_MS = 15000;

router.post('/detect', upload.array('images', 6), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'Upload at least one inspiration image.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
    return res.status(500).json({ message: 'AI matching is not configured. Set GEMINI_API_KEY in server/.env.' });
  }

  try {
    const taxonomy = TAXONOMY;
    const categories = Object.keys(taxonomy);
    const allStyles = Array.from(new Set(Object.values(taxonomy).flat()));

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const data = (await fs.readFile(file.path)).toString('base64');
        return createPartFromBase64(data, file.mimetype);
      })
    );

    const detectionItemSchema = {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, format: 'enum', enum: categories },
        style: {
          type: Type.STRING,
          format: 'enum',
          enum: allStyles,
          nullable: true,
          description: 'Set to null if no style under this category clearly matches the image.',
        },
        confidence: { type: Type.NUMBER },
      },
      required: ['category', 'style', 'confidence'],
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        detections: {
          type: Type.ARRAY,
          minItems: '1',
          maxItems: '3',
          items: detectionItemSchema,
          description: 'Up to 3 candidate categories this image could belong to, ranked most likely first.',
        },
      },
      required: ['detections'],
    };

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const promptText =
      imageParts.length > 1
        ? `Classify these ${imageParts.length} inspiration images together, as one combined style, against the allowed category/style lists. Return your top 1-3 most likely categories, ranked most likely first — only include a second or third candidate if it is a genuinely plausible alternative, not just to fill the list. For each, include a style only if one clearly matches across the images.`
        : 'Classify this inspiration image against the allowed category/style lists. Return your top 1-3 most likely categories, ranked most likely first — only include a second or third candidate if it is a genuinely plausible alternative, not just to fill the list. For each, include a style only if one clearly matches.';

    // gemini-3.7-flash (very recently released) is currently under heavy
    // capacity strain on Google's side and intermittently returns 503, or
    // simply hangs with no error at all. Retry it once, then fall back to
    // gemini-3.6-flash — gemini-2.5-flash is no longer available to new API
    // keys (confirmed via a live 404 from Google).
    const modelsToTry = ['gemini-3.7-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < modelsToTry.length; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GENERATION_ATTEMPT_TIMEOUT_MS);
      try {
        response = await ai.models.generateContent({
          model: modelsToTry[attempt],
          contents: createUserContent([...imageParts, promptText]),
          config: {
            systemInstruction:
              'You classify creative-industry reference photos for CreativeHUB, a freelancer marketplace. ' +
              'You must only choose values from this exact category -> styles mapping (CreativeHUB\'s only supported freelancer categories), never invent new ones:\n' +
              JSON.stringify(taxonomy, null, 2),
            responseMimeType: 'application/json',
            responseSchema,
            abortSignal: controller.signal,
          },
        });
        lastError = undefined;
        break;
      } catch (attemptError) {
        lastError = attemptError;
        const status = (attemptError as { status?: number; name?: string } | null)?.status;
        const timedOut = (attemptError as { name?: string } | null)?.name === 'AbortError';
        const retryable = status === 503 || status === 429 || timedOut;
        if (!retryable || attempt === modelsToTry.length - 1) throw attemptError;
        if (!timedOut) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
    if (lastError || !response) throw lastError;

    const raw = response.text;
    if (!raw) {
      return res.status(502).json({ message: 'AI could not classify this image. Please try another photo.' });
    }

    const DetectionSchema = z.object({
      detections: z
        .array(
          z.object({
            category: z.enum(categories as [string, ...string[]]),
            style: z.string().nullable(),
            confidence: z.number().min(0).max(1),
          })
        )
        .min(1)
        .max(3),
    });

    const parsed = DetectionSchema.parse(JSON.parse(raw));

    // De-dupe by category (keep the highest-confidence one) in case the
    // model returns the same category twice with different styles.
    const byCategory = new Map<string, (typeof parsed.detections)[number]>();
    for (const detection of parsed.detections) {
      const existing = byCategory.get(detection.category);
      if (!existing || detection.confidence > existing.confidence) {
        byCategory.set(detection.category, detection);
      }
    }

    const detections = Array.from(byCategory.values())
      .sort((a, b) => b.confidence - a.confidence)
      .map((detection) => ({
        category: detection.category,
        style: detection.style && taxonomy[detection.category]?.includes(detection.style) ? detection.style : null,
        confidence: detection.confidence,
      }));

    return res.json({ detections, taxonomy });
  } catch (error) {
    console.error(error);
    const status = (error as { status?: number } | null)?.status;
    const message =
      status === 503
        ? 'The AI model is experiencing high demand right now. Please try again in a moment.'
        : 'Unable to analyze the image right now.';
    return res.status(502).json({ message });
  } finally {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
});

router.post('/embed', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI matching is not configured. Set GEMINI_API_KEY in server/.env.' });
  }

  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'text is required.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: { outputDimensionality: 768 },
    });
    const embedding = response.embeddings?.[0]?.values;
    if (!embedding || embedding.length !== 768) {
      return res.status(502).json({ message: 'Embedding generation failed.' });
    }
    return res.json({ embedding });
  } catch (error) {
    console.error(error);
    const status = (error as { status?: number } | null)?.status;
    const message =
      status === 503
        ? 'The AI model is experiencing high demand right now. Please try again in a moment.'
        : 'Unable to generate an embedding right now.';
    return res.status(502).json({ message });
  }
});

const handleUploadError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(400).json({ message: error.message || 'Unable to process the uploaded image.' });
};

router.use(handleUploadError);

export default router;
