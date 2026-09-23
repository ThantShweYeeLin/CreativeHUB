// Vercel Serverless Function for the support chat widget on the live
// website: POST /api/chatbot/message. Lives in the frontend's own Vercel
// project, so the chatbot works without deploying the separate Express
// server. All the logic is in ../_lib/chatbot.js (shared with that server).
//
// Needs these environment variables on the website's Vercel project:
// GEMINI_API_KEY and/or GROQ_API_KEY (plus VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY, which the site already has).

import { handleChatbotMessage } from '../_lib/chatbot.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const { status, json } = await handleChatbotMessage({
    body: req.body,
    authorization: req.headers.authorization,
  });
  return res.status(status).json(json);
}
