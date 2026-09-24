// Support chatbot logic. This is a local copy of the repo root's
// api/_lib/chatbot.js (the Vercel function on the live website uses that
// one) — duplicated here because this Express server deploys as its own
// standalone Vercel project and can't reach files outside server/ at
// runtime. Keep both copies in sync by hand if this changes.
// Plain JS with zero dependencies beyond @supabase/supabase-js (a
// dependency of this project too); the AI providers are called over REST
// with fetch.
//
// Providers: Gemini (GEMINI_API_KEY) and Groq (GROQ_API_KEY). With both keys
// set, the preferred one (CHATBOT_PROVIDER, default "gemini") is tried first
// and the other is used automatically if it fails (rate limit, outage, bad
// key). Override the models with GEMINI_MODEL / GROQ_MODEL.

import { createClient } from '@supabase/supabase-js';

// CreativeHUB's freelancer categories, kept in sync by hand with
// src/lib/categories.ts.
const CATEGORIES = [
  'Photographer',
  'Videographer',
  'Makeup Artist',
  'Hair Stylist',
  'Fashion Designer',
  'Decorator',
  'Cake/Dessert Maker',
  'Musician',
];

const SYSTEM_INSTRUCTION = `
You are the support assistant embedded in CreativeHUB, a marketplace that connects clients with creative
freelancers (${CATEGORIES.join(', ')}) for bookings like shoots, weddings, and events.

What you know about how CreativeHUB works:
- Clients discover freelancers via Explore, Map, For You, and the Event Matcher (a rule-based recommender —
  not AI — that suggests freelancers by event type, theme, and budget). They can send a single booking
  Request or a Group Request that invites multiple freelancers to the same event.
- A booking goes through negotiation: either side can counter price/schedule before it's accepted, then
  payment is held in escrow until the booking is completed.
- On the day of the event, both sides can check in for attendance verification; if someone doesn't show or
  work isn't delivered as agreed, either side can report a problem and attach evidence, which starts a
  single-round dispute process reviewed by CreativeHUB admins if it isn't resolved directly.
- Users message each other directly (Messages page) once a request is open. There's also a social feed of
  posts (with comments, saves, and sharing) freelancers and clients can browse.
- Freelancers manage their business from the Freelancer Dashboard: requests, bookings, calendar
  availability, analytics, earnings, reviews, and teams (multiple freelancers collaborating under one
  profile). Becoming a freelancer is an onboarding flow ("Become a Freelancer") separate from the client
  role.
- There's an Admin dashboard for platform moderation and dispute review, and users can block each other and
  control profile visibility from Settings. Terms of Service and Privacy Policy are available from the
  footer/legal pages.

How to answer:
- Be concise and friendly. Prefer short, direct answers over long explanations.
- Only answer questions about using CreativeHUB (account, bookings, payments, messaging, becoming a
  freelancer, etc.). For anything else (general chit-chat is fine briefly, but off-topic requests, coding
  help, etc. are not), politely redirect to CreativeHUB topics.
- Never invent specific policies, prices, fees, timelines, or booking details you don't actually know. If
  asked something you can't answer confidently, say so plainly and suggest contacting support instead of
  guessing.
- Never ask for or repeat back passwords, payment card numbers, or other sensitive credentials.

The user is signed in. When they ask about their own bookings, payments, or booking status (e.g. "what's
the status of my booking?", "how much have I paid?", "do I have anything upcoming?"), call the
get_my_bookings tool rather than guessing — only state booking details that tool actually returned, and
never fabricate a booking, amount, or status. Amounts (budget etc.) are in Thai Baht — show them as ฿.
`.trim();

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_ITERATIONS = 3;

const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const GET_MY_BOOKINGS_DECLARATION = {
  name: 'get_my_bookings',
  description:
    "Look up the signed-in user's own bookings on CreativeHUB (as client or freelancer) — project name, " +
    'status, budget, payment status, dispute status, and dates. Use this for any question about the ' +
    "user's own bookings or payments.",
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: BOOKING_STATUSES,
        description: 'Optional — only return bookings with this status.',
      },
      limit: {
        type: 'integer',
        description: 'Max bookings to return, most recent first. Defaults to 10, max 20.',
      },
    },
    required: [],
  },
};

// Groq validates tool arguments strictly, and its models tend to send null
// for optional parameters they don't need — so allow null there.
const GROQ_BOOKINGS_TOOL = {
  type: 'function',
  function: {
    ...GET_MY_BOOKINGS_DECLARATION,
    parameters: {
      ...GET_MY_BOOKINGS_DECLARATION.parameters,
      properties: {
        status: { ...GET_MY_BOOKINGS_DECLARATION.parameters.properties.status, type: ['string', 'null'], enum: [...BOOKING_STATUSES, null] },
        limit: { ...GET_MY_BOOKINGS_DECLARATION.parameters.properties.limit, type: ['integer', 'null'] },
      },
    },
  },
};

// Per-user message limit, so one account can't burn through the AI quota.
// Best-effort: counts live in this function instance's memory, so they reset
// on cold starts and aren't shared between parallel instances.
const RATE_LIMIT_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const recentMessagesByUser = new Map();

function isRateLimited(userId) {
  const now = Date.now();
  const recent = (recentMessagesByUser.get(userId) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MESSAGES) {
    recentMessagesByUser.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentMessagesByUser.set(userId, recent);
  return false;
}

const HIGH_DEMAND = 'The assistant is experiencing high demand right now. Please try again in a moment.';
const MISCONFIGURED = 'The chat assistant is misconfigured. Please contact support.';

// Carries a user-facing message; anything else becomes a generic error.
class ChatbotError extends Error {}

function createUserSupabase(env, accessToken) {
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY (or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Row-Level Security on `bookings` scopes this to bookings where the caller
// is the client or the freelancer. Only a curated column set goes to the
// model, not the full row.
async function getMyBookings(userSupabase, args) {
  const limit = Math.min(Math.max(Math.trunc(Number(args?.limit) || 10), 1), 20);

  let query = userSupabase
    .from('bookings')
    .select(
      'id, project_name, status, budget, payment_status, dispute_status, start_date, end_date, created_at, ' +
        'freelancer:freelancer_id(full_name), client:client_id(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (BOOKING_STATUSES.includes(args?.status)) {
    query = query.eq('status', args.status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { bookings: data ?? [] };
}

function runTool(userSupabase, name, args) {
  return name === 'get_my_bookings' ? getMyBookings(userSupabase, args) : { error: `Unknown tool: ${name}` };
}

function errorForStatus(provider, status) {
  if (status === 429) return new ChatbotError(HIGH_DEMAND);
  if (status === 400 || status === 401 || status === 403) return new ChatbotError(MISCONFIGURED);
  return new Error(`${provider} request failed with status ${status}`);
}

async function replyWithGemini(env, history, message, userSupabase) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 },
        tools: [{ functionDeclarations: [GET_MY_BOOKINGS_DECLARATION] }],
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Gemini API error:', response.status, body?.error?.message);
      throw errorForStatus('Gemini', response.status);
    }

    const content = body.candidates?.[0]?.content;
    const parts = content?.parts ?? [];
    const functionCalls = parts.filter((part) => part.functionCall).map((part) => part.functionCall);

    if (functionCalls.length) {
      // Echo the model's turn back unchanged — newer Gemini models attach
      // thought signatures to function-call parts that must be returned.
      contents.push(content);
      const responses = [];
      for (const call of functionCalls) {
        const result = await runTool(userSupabase, call.name, call.args ?? {});
        responses.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: 'user', parts: responses });
      continue;
    }

    return parts
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text)
      .join('')
      .trim();
  }

  return undefined;
}

// Groq's API is OpenAI-compatible.
async function replyWithGroq(env, history, message, userSupabase) {
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const messages = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map((turn) => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.text })),
    { role: 'user', content: message },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: 1024,
        messages,
        tools: [GROQ_BOOKINGS_TOOL],
        tool_choice: 'auto',
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Groq API error:', response.status, body?.error?.message);
      throw errorForStatus('Groq', response.status);
    }

    const assistantMessage = body.choices?.[0]?.message;
    if (!assistantMessage) break;

    const toolCalls = assistantMessage.tool_calls;
    if (toolCalls?.length) {
      messages.push({ role: 'assistant', content: assistantMessage.content ?? null, tool_calls: toolCalls });
      for (const toolCall of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          // malformed arguments from the model — proceed with defaults
        }
        const result = await runTool(userSupabase, toolCall.function.name, args);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return assistantMessage.content ?? undefined;
  }

  return undefined;
}

function parseRequest(body) {
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;

  const rawHistory = body.history ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY_MESSAGES) return null;

  const history = [];
  for (const turn of rawHistory) {
    const text = typeof turn?.text === 'string' ? turn.text.trim() : '';
    if ((turn?.role !== 'user' && turn?.role !== 'model') || !text || text.length > MAX_MESSAGE_LENGTH) return null;
    history.push({ role: turn.role, text });
  }

  return { message, history };
}

/**
 * Handles one chat message. Framework-agnostic: callers pass the parsed JSON
 * body, the Authorization header, and the environment, and send back the
 * returned { status, json }.
 */
export async function handleChatbotMessage({ body, authorization, env = process.env }) {
  const providers = [
    env.GEMINI_API_KEY && { name: 'gemini', reply: replyWithGemini },
    env.GROQ_API_KEY && { name: 'groq', reply: replyWithGroq },
  ].filter(Boolean);
  if (env.CHATBOT_PROVIDER === 'groq') providers.reverse();

  if (!providers.length) {
    return { status: 500, json: { message: 'The chat assistant is not configured. Set GEMINI_API_KEY or GROQ_API_KEY.' } };
  }

  const parsed = parseRequest(body);
  if (!parsed) {
    return { status: 400, json: { message: 'A non-empty message is required.' } };
  }

  // Signed-in users only: keeps the AI keys from being used by anyone on
  // the internet, and the booking tool needs the caller's identity anyway.
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (!token) {
    return { status: 401, json: { message: 'Authentication required.' } };
  }
  let userSupabase;
  let userId;
  try {
    userSupabase = createUserSupabase(env, token);
    const { data, error } = await userSupabase.auth.getUser();
    if (error || !data.user) {
      return { status: 401, json: { message: 'Invalid or expired session.' } };
    }
    userId = data.user.id;
  } catch (error) {
    console.error('Chatbot auth check failed:', error);
    return { status: 401, json: { message: 'Invalid or expired session.' } };
  }

  if (isRateLimited(userId)) {
    return { status: 429, json: { message: "You've sent a lot of messages — please wait a bit before asking again." } };
  }

  let lastError;
  for (const provider of providers) {
    try {
      const reply = await provider.reply(env, parsed.history, parsed.message, userSupabase);
      if (reply) return { status: 200, json: { reply } };
      lastError = new ChatbotError("The assistant couldn't come up with a reply. Please try again.");
    } catch (error) {
      console.error(`Chatbot provider "${provider.name}" failed:`, error);
      lastError = error;
    }
  }

  const message = lastError instanceof ChatbotError ? lastError.message : 'Unable to reach the chat assistant right now.';
  return { status: 502, json: { message } };
}
