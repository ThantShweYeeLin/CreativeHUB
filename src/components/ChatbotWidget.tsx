import { useEffect, useRef, useState } from 'react';
import { ChevronRight, CreditCard, Crown, Flag, MessageCircle, Package, Scale, Search, Send, Star, Users, X, type LucideIcon } from 'lucide-react';
import { sendChatbotMessage, type ChatTurn } from '../lib/chatbotService';

interface DisplayMessage extends ChatTurn {
  id: string;
  error?: boolean;
}

const GREETING = "Hi! I'm the CreativeHUB assistant. Ask me anything about bookings, payments, or becoming a freelancer.";
const MAX_HISTORY_TURNS = 20;

const SUGGESTED_PROMPTS: { icon: LucideIcon; text: string }[] = [
  { icon: Package, text: "What's my booking status?" },
  { icon: Flag, text: 'How do I report an issue?' },
  { icon: CreditCard, text: 'How does escrow & payment work?' },
  { icon: Star, text: 'How do I become a freelancer?' },
  { icon: Search, text: 'How do I book a freelancer?' },
  { icon: Users, text: "What's a Group Request?" },
  { icon: Scale, text: 'How do disputes get resolved?' },
  { icon: Crown, text: 'What does Premium include?' },
];

// Rendered once at the app root, alongside MobileBottomNav, so it floats on
// every authenticated page rather than needing to be wired into each one.
export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    if (!text || isSending) return;

    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: 'user', text };
    const history: ChatTurn[] = [...messages, userMessage].slice(-MAX_HISTORY_TURNS).map(({ role, text: t }) => ({ role, text: t }));

    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setIsSending(true);

    try {
      const reply = await sendChatbotMessage(text, history.slice(0, -1));
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'model', text: reply }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'model', text, error: true }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-x-4 bottom-24 z-[1300] flex h-[60vh] max-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:w-96 md:bottom-6">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold">CreativeHUB Assistant</span>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">{GREETING}</div>
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Quick questions</p>
                <div className="overflow-hidden rounded-2xl border border-gray-200 divide-y divide-gray-200">
                  {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => handleSend(text)}
                      disabled={isSending}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="flex-1">{text}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto rounded-br-sm bg-gray-900 text-white'
                    : m.error
                      ? 'rounded-bl-sm bg-red-50 text-red-700'
                      : 'rounded-bl-sm bg-gray-100 text-gray-800'
                }`}
              >
                {m.text}
              </div>
            ))}
            {isSending && <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-400">Thinking…</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question…"
              className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!draft.trim() || isSending}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close chat assistant' : 'Open chat assistant'}
        className="fixed bottom-24 right-4 z-[1300] flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-xl transition-transform hover:scale-105 md:bottom-6"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
