import { Router } from 'express';
// A local copy of the live website's chatbot logic (api/_lib/chatbot.js in
// the repo root, used by the frontend's own Vercel function). Duplicated
// here rather than imported across the boundary because this server is
// deployed as its own standalone Vercel project (Root Directory: server/)
// and can't reach files outside that directory at runtime. Keep both copies
// in sync by hand if the chatbot's prompt/providers/tools change.
import { handleChatbotMessage } from '../lib/chatbot.js';

const router = Router();

router.post('/message', async (req, res) => {
  const { status, json } = await handleChatbotMessage({
    body: req.body,
    authorization: req.headers.authorization,
  });
  return res.status(status).json(json);
});

export default router;
