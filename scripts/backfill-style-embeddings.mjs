// One-time backfill: generates a style_embedding for every freelancer_profile
// that doesn't have a "ready" one yet, using the same profile-text template
// and embedding endpoint the app uses at runtime (src/lib/aiMatching.ts).
// Safe to re-run — anything already 'ready' is skipped.
//
// Usage: node scripts/backfill-style-embeddings.mjs
// Requires: the dev server running (npm run dev, so localhost:4000 is up)
// and .env.local with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = new URL('../.env.local', import.meta.url);
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const API_BASE = env.VITE_API_BASE_URL || 'http://localhost:4000/api';

function buildFreelancerStyleProfileText({ category, skills, styles, description }) {
  return `
Profession: ${category}

Skills:
${(skills || []).join(', ') || 'Not specified'}

Style:
${(styles || []).join(', ') || 'Not specified'}

Profile description:
${description || 'Not provided'}
`.trim();
}

async function embedText(text) {
  const response = await fetch(`${API_BASE}/ai-matcher/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `HTTP ${response.status}`);
  }
  const embedding = body.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 768) {
    throw new Error('Invalid embedding dimension');
  }
  return embedding;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const { data: profiles, error } = await supabase
    .from('freelancer_profiles')
    .select('id, user_id, title, skills, styles, description, style_embedding, embedding_status');

  if (error) {
    console.error('Failed to load freelancer_profiles:', error.message);
    process.exit(1);
  }

  const total = profiles.length;
  const alreadyReady = profiles.filter((p) => p.embedding_status === 'ready' && p.style_embedding).length;
  const toProcess = profiles.filter((p) => !(p.embedding_status === 'ready' && p.style_embedding));

  let generated = 0;
  let failed = 0;
  const failures = [];

  for (const profile of toProcess) {
    const text = buildFreelancerStyleProfileText(profile);
    try {
      const embedding = await embedText(text);
      const { error: updateError } = await supabase
        .from('freelancer_profiles')
        .update({
          style_embedding: embedding,
          embedding_status: 'ready',
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      generated += 1;
      console.log(`  ok    ${profile.id}  ${profile.title || '(no title)'}`);
    } catch (err) {
      failed += 1;
      failures.push({ id: profile.id, title: profile.title, error: err.message });
      await supabase
        .from('freelancer_profiles')
        .update({ embedding_status: 'failed', embedding_updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      console.log(`  FAIL  ${profile.id}  ${profile.title || '(no title)'}  — ${err.message}`);
    }
    // Small gap between calls to stay well under Gemini rate limits.
    await sleep(300);
  }

  console.log('\nEmbedding Backfill Complete\n');
  console.log(`Total freelancers: ${total}`);
  console.log(`Already had embeddings: ${alreadyReady}`);
  console.log(`Embeddings generated: ${generated}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log('\nFailed profiles (embedding_status set to "failed", retryable by re-running this script):');
    for (const f of failures) {
      console.log(`  - ${f.id} (${f.title || 'no title'}): ${f.error}`);
    }
  }
}

run();
