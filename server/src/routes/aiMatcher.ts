import { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { GoogleGenAI, Type, createUserContent, createPartFromBase64 } from '@google/genai';
import { z } from 'zod';
import { createSupabaseForRequest } from '../lib/supabase.js';

const router = Router();

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const uploadDirectory = path.join(os.tmpdir(), 'creativehub-ai-matcher');

const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new Error('Only JPG, PNG, WebP, and GIF images are supported.'));
      return;
    }

    callback(null, true);
  },
});

// The AI must only choose a category/style that a real freelancer on
// CreativeHUB already has, so we read the live set of values out of
// freelancer_profiles instead of a hardcoded list — profiles are free-text
// on category (title) and style, and existing data doesn't follow any fixed
// enum (e.g. "Brand Designer" / "Douyin" show up alongside "Photographer").
async function loadTaxonomy(): Promise<Record<string, string[]>> {
  const supabase = createSupabaseForRequest();
  const { data, error } = await supabase
    .from('freelancer_profiles')
    .select('title, styles')
    .eq('is_available', true);

  if (error) throw error;

  const taxonomy: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    const category = (row as any).title?.trim();
    if (!category) continue;
    if (!taxonomy[category]) taxonomy[category] = new Set();
    for (const style of (row as any).styles ?? []) {
      if (typeof style === 'string' && style.trim()) taxonomy[category].add(style.trim());
    }
  }

  return Object.fromEntries(Object.entries(taxonomy).map(([category, styles]) => [category, Array.from(styles)]));
}

router.post('/detect', upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'Upload an inspiration image.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(500).json({ message: 'AI matching is not configured. Set GEMINI_API_KEY in server/.env.' });
  }

  try {
    const taxonomy = await loadTaxonomy();
    const categories = Object.keys(taxonomy);
    if (categories.length === 0) {
      return res.status(502).json({ message: 'No freelancer categories are set up yet.' });
    }

    const allStyles = Array.from(new Set(Object.values(taxonomy).flat()));

    const imageData = (await fs.readFile(file.path)).toString('base64');
    const mediaType = file.mimetype;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, format: 'enum', enum: categories },
        style: {
          type: Type.STRING,
          format: 'enum',
          enum: allStyles,
          nullable: true,
          description: 'Set to null if no style under the chosen category clearly matches the image.',
        },
        confidence: { type: Type.NUMBER },
      },
      required: ['category', 'style', 'confidence'],
    };

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // gemini-3.7-flash (very recently released) is currently under heavy
    // capacity strain on Google's side and intermittently returns 503. Retry
    // it once, then fall back to gemini-3.6-flash — gemini-2.5-flash is no
    // longer available to new API keys (confirmed via a live 404 from Google).
    const modelsToTry = ['gemini-3.7-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < modelsToTry.length; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model: modelsToTry[attempt],
          contents: createUserContent([
            createPartFromBase64(imageData, mediaType),
            'Classify this inspiration image into the closest category and, if a clearly matching one exists, style from the allowed lists.',
          ]),
          config: {
            systemInstruction:
              'You classify creative-industry reference photos for CreativeHUB, a freelancer marketplace. ' +
              'You must only choose values from this exact category -> styles mapping (real freelancer data), never invent new ones:\n' +
              JSON.stringify(taxonomy, null, 2),
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
        lastError = undefined;
        break;
      } catch (attemptError) {
        lastError = attemptError;
        const status = (attemptError as { status?: number } | null)?.status;
        const retryable = status === 503 || status === 429;
        if (!retryable || attempt === modelsToTry.length - 1) throw attemptError;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
    if (lastError || !response) throw lastError;

    const raw = response.text;
    if (!raw) {
      return res.status(502).json({ message: 'AI could not classify this image. Please try another photo.' });
    }

    const DetectionSchema = z.object({
      category: z.enum(categories as [string, ...string[]]),
      style: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    });

    const parsed = DetectionSchema.parse(JSON.parse(raw));
    const styleBelongsToCategory = Boolean(parsed.style && taxonomy[parsed.category]?.includes(parsed.style));

    return res.json({
      category: parsed.category,
      style: styleBelongsToCategory ? parsed.style : null,
      confidence: parsed.confidence,
      taxonomy,
    });
  } catch (error) {
    console.error(error);
    const status = (error as { status?: number } | null)?.status;
    const message =
      status === 503
        ? 'The AI model is experiencing high demand right now. Please try again in a moment.'
        : 'Unable to analyze the image right now.';
    return res.status(502).json({ message });
  } finally {
    await fs.unlink(file.path).catch(() => {});
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
