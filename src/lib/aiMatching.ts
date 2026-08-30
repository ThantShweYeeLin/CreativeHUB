const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api';

export interface FreelancerStyleProfileInput {
  category: string;
  skills: string[];
  styles: string[];
  description: string;
}

// One shared, explicitly-structured template so freelancer and client
// embeddings stay comparable — the model is effectively reading a small
// structured document, not a bare sentence.
export function buildFreelancerStyleProfileText({ category, skills, styles, description }: FreelancerStyleProfileInput): string {
  return `
Profession: ${category}

Skills:
${skills.join(', ') || 'Not specified'}

Style:
${styles.join(', ') || 'Not specified'}

Profile description:
${description || 'Not provided'}
`.trim();
}

export function buildClientQueryText({ category, description }: { category: string; description: string }): string {
  return `
Profession needed: ${category}

Client's desired style:
${description}
`.trim();
}

export interface StyleDetection {
  category: string;
  style: string | null;
  confidence: number;
}

export async function detectImageStyle(file: File): Promise<{ detections: StyleDetection[]; taxonomy: Record<string, string[]> }> {
  const formData = new FormData();
  formData.append('image', file);

  // The underlying Gemini call has no server-side timeout and can, in
  // practice, take minutes rather than seconds — image analysis is optional
  // context here, so a slow response should fail fast (falling back to
  // text-only matching) rather than leaving the form stuck indefinitely.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/ai-matcher/detect`, { method: 'POST', body: formData, signal: controller.signal });
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Image analysis is taking too long. You can continue without it, or try again.');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || 'Unable to analyze the image right now.');
  }

  const detections: StyleDetection[] = Array.isArray(body.detections) ? body.detections : [];
  if (detections.length === 0) {
    throw new Error('AI could not classify this image. Please try another photo.');
  }

  return { detections, taxonomy: body.taxonomy ?? {} };
}

export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${API_BASE}/ai-matcher/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || 'Unable to generate an embedding right now.');
  }

  const embedding = body.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 768) {
    throw new Error('Invalid embedding dimension.');
  }

  return embedding;
}
