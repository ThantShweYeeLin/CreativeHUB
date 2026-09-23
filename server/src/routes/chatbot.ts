import { Router } from 'express';
// Shared with the live website's Vercel function (api/chatbot/message.js) so
// there's one copy of the chatbot — prompt, providers, and booking tool.
import { handleChatbotMessage } from '../../../api/_lib/chatbot.js';

const router = Router();

router.post('/message', async (req, res) => {
  const { status, json } = await handleChatbotMessage({
    body: req.body,
    authorization: req.headers.authorization,
  });
  return res.status(status).json(json);
});

export default router;
