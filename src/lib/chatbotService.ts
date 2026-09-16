import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export async function sendChatbotMessage(message: string, history: ChatTurn[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  // Sent so the backend can answer account-specific questions (e.g. "what's
  // the status of my booking?") by looking up the caller's own data — see
  // server/src/routes/chatbot.ts's get_my_bookings tool. Chat still works
  // signed out; the tool is simply unavailable then.
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
