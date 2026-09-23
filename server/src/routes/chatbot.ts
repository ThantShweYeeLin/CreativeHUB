import { Router } from 'express';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

const router = Router();

// CreativeHUB's freelancer categories, kept in sync by hand with
// src/lib/categories.ts — this is a separately-built TS project (see
// server/tsconfig.json's rootDir) so it can't import that file directly.
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

const BASE_SYSTEM_INSTRUCTION = `
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
`.trim();

const AUTHENTICATED_ADDENDUM = `
The user is signed in. When they ask about their own bookings, payments, or booking status (e.g. "what's
the status of my booking?", "how much have I paid?", "do I have anything upcoming?"), call the
get_my_bookings tool rather than guessing — only state booking details that tool actually returned, and
never fabricate a booking, amount, or status.
`.trim();

const UNAUTHENTICATED_ADDENDUM = `
The user is not signed in, so you have no access to their personal account data. If they ask about their
own bookings or payments, tell them to log in to CreativeHUB first.
`.trim();

// Free-tier Groq model — solid general quality for a scoped FAQ bot.
// Override with GROQ_MODEL if this one is ever retired; see
// console.groq.com/docs/models for the current lineup.
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_ITERATIONS = 3;

const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
      })
    )
    .max(MAX_HISTORY_MESSAGES)
    .optional(),
});

const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;

const GET_MY_BOOKINGS_TOOL: Groq.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
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
  },
};

// Row-Level Security on `bookings` scopes this to bookings where the caller
// is the client or the freelancer — same unfiltered-select-relies-on-RLS
// pattern as GET /api/bookings (see bookings.ts). Only a curated column set
// goes to the model, not the full row (avoids leaking unrelated internal
// fields into the prompt).
async function getMyBookings(userSupabase: ReturnType<typeof createSupabaseForRequest>, args: { status?: string; limit?: number }) {
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? 10), 1), 20);

  let query = userSupabase
    .from('bookings')
    .select(
      'id, project_name, status, budget, payment_status, dispute_status, start_date, end_date, created_at, ' +
        'freelancer:freelancer_id(full_name), client:client_id(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status && (BOOKING_STATUSES as readonly string[]).includes(args.status)) {
    query = query.eq('status', args.status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { bookings: data ?? [] };
}

router.post('/message', async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ message: 'The chat assistant is not configured. Set GROQ_API_KEY in server/.env.' });
  }

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'A non-empty message is required.' });
  }
  const { message, history = [] } = parsed.data;

  // Optional auth — chat works signed out too, just without account tools.
  const token = getBearerToken(req.headers.authorization);
  let userSupabase: ReturnType<typeof createSupabaseForRequest> | null = null;
  if (token) {
    try {
      const client = createSupabaseForRequest(token);
      const { data: userData, error: userError } = await client.auth.getUser();
      if (!userError && userData.user) {
        userSupabase = client;
      }
    } catch (error) {
      console.error('Chatbot auth check failed:', error);
    }
  }
  const authenticated = Boolean(userSupabase);

  try {
    const groq = new Groq();

    // The frontend's ChatTurn type uses 'model' (a holdover from this
    // route's earlier Gemini implementation) — map it to 'assistant'.
    let messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: `${BASE_SYSTEM_INSTRUCTION}\n\n${authenticated ? AUTHENTICATED_ADDENDUM : UNAUTHENTICATED_ADDENDUM}` },
      ...history.map((turn): Groq.Chat.ChatCompletionMessageParam => ({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: turn.text,
      })),
      { role: 'user', content: message },
    ];

    let reply: string | null | undefined;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await groq.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 1024,
        messages,
        ...(authenticated ? { tools: [GET_MY_BOOKINGS_TOOL], tool_choice: 'auto' as const } : {}),
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) break;

      const toolCalls = assistantMessage.tool_calls;
      if (toolCalls?.length && userSupabase) {
        messages = [...messages, { role: 'assistant', content: assistantMessage.content ?? null, tool_calls: toolCalls }];

        for (const toolCall of toolCalls) {
          let args: { status?: string; limit?: number } = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            // malformed arguments from the model — proceed with defaults
          }

          const result = toolCall.function.name === 'get_my_bookings' ? await getMyBookings(userSupabase, args) : { error: `Unknown tool: ${toolCall.function.name}` };

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }
        continue;
      }

      reply = assistantMessage.content;
      break;
    }

    if (!reply) {
      return res.status(502).json({ message: "The assistant couldn't come up with a reply. Please try again." });
    }

    return res.json({ reply });
  } catch (error) {
    console.error(error);
    let message = 'Unable to reach the chat assistant right now.';
    if (error instanceof Groq.RateLimitError) {
      message = 'The assistant is experiencing high demand right now. Please try again in a moment.';
    } else if (error instanceof Groq.AuthenticationError) {
      message = 'The chat assistant is misconfigured. Please contact support.';
    }
    return res.status(502).json({ message });
  }
});

export default router;
