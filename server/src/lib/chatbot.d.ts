// Types for chatbot.js so the TypeScript Express server can import it.
export function handleChatbotMessage(input: {
  body: unknown;
  authorization?: string;
  env?: Record<string, string | undefined>;
}): Promise<{ status: number; json: { reply?: string; message?: string } }>;
