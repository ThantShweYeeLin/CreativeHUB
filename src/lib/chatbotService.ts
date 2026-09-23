import { supabase } from './supabase';

// On the live site the chatbot is served by the website's own Vercel function
// (api/chatbot/message.js), so it's always same-origin there. In local dev it
// goes to the Express server, which runs the same shared code.
const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api'
  : '/api';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export async function sendChatbotMessage(message: string, history: ChatTurn[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  // Sent so the backend can answer account-specific questions (e.g. "what's
  // the status of my booking?") by looking up the caller's own data — see
  // api/_lib/chatbot.js's get_my_bookings tool. The endpoint only answers
  // signed-in users.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chatbot/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('That took too long to answer. Please try again.');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || 'Unable to reach the chat assistant right now.');
  }

  if (typeof body.reply !== 'string' || !body.reply) {
    throw new Error("The assistant couldn't come up with a reply. Please try again.");
  }

  return body.reply;
}
