import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageCircleMore, Send, Sparkles, X } from 'lucide-react';
import { DataService } from '../../lib/dataService';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

// Inline negotiation chat, embedded directly in a request card instead of
// navigating away to the general /messages page. The point is to let a
// client and freelancer talk through a price/schedule before either of
// them spends one of the MAX_NEGOTIATION_ROUNDS formal counters on it -
// chat never changes the recorded price/date itself, Counter/Accept still
// do that; this is just where the "why" gets said out loud first. Backed
// by the same conversations/messages tables and RLS as the general
// messaging system (see supabase/conversations_messages_rls_hardening.sql) -
// forceAccepted so it's usable immediately regardless of mutual-follow
// status, same reasoning as AdminMessagesPage.tsx's admin-initiated threads.
export function RequestChatThread({
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  defaultOpen = false,
}: {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string | null;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const avatar = otherUserAvatar || DEFAULT_AVATAR_URL;

  // DataService.createRequest already ensures this conversation exists the
  // moment a request is sent, but this call stays as a safety net for
  // requests created before this feature existed, or any other path that
  // doesn't go through that function.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!otherUserId) return;
      const ensured = await DataService.ensureConversation(currentUserId, otherUserId, { forceAccepted: true });
      if (!isMounted) return;
      if (ensured.data) {
        setConversationId(ensured.data.id);
      } else {
        // Previously failed silently here - the box just stayed empty
        // forever with nothing to tell you why, every "send" a no-op since
        // handleSend bails out without a conversationId.
        setError((ensured.error as any)?.message || 'Unable to start this conversation.');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    if (!conversationId) return;
    let isMounted = true;

    const load = async () => {
      const response = await DataService.getMessages(conversationId);
      if (!isMounted) return;
      const ordered = (response.data || []).slice().reverse();
      setMessages(ordered);
      setUnreadCount(ordered.filter((m: any) => m.recipient_id === currentUserId && !m.read).length);
    };
    void load();

    const channel = DataService.subscribeToMessages(conversationId, () => void load());
    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (isOpen && conversationId && unreadCount > 0) {
      void DataService.markMessagesAsRead(conversationId, currentUserId).then(() => setUnreadCount(0));
    }
  }, [isOpen, conversationId, currentUserId, unreadCount]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isOpen]);

  const handleSend = async () => {
    if (!conversationId || !draft.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    const response = await DataService.sendMessage({
      conversation_id: conversationId,
      sender_id: currentUserId,
      recipient_id: otherUserId,
      content: draft.trim(),
      read: false,
    } as any);
    setIsSending(false);
    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to send message.');
      return;
    }
    // Don't wait on the realtime round-trip to show your own message - the
    // subscription's onChange still fires and re-fetches, but this `some()`
    // guard means that later refetch just no-ops instead of duplicating it.
    setMessages((current) => (current.some((item) => item.id === response.data.id) ? current : [...current, response.data]));
    setDraft('');
  };

  const lastMessage = messages[messages.length - 1];
  const lastMessagePreview = lastMessage
    ? `${lastMessage.sender_id === currentUserId ? 'You: ' : ''}${lastMessage.content}`
    : null;

  if (!isOpen) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="group mt-3 flex w-full items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50/60 px-3.5 py-3 text-left transition-all hover:border-sky-200 hover:shadow-md hover:shadow-sky-500/10"
      >
        <div className="relative shrink-0">
          <Avatar src={avatar} alt={otherUserName} sizeClassName="h-10 w-10 ring-2 ring-white" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-sky-600 px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            Message {otherUserName}
          </p>
          <p className="truncate text-xs text-gray-500">
            {lastMessagePreview || (
              <span className="inline-flex items-center gap-1 text-sky-600">
                <Sparkles className="h-3 w-3" /> Talk it through before you counter
              </span>
            )}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-gray-400 transition-transform group-hover:text-sky-500" />
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm"
    >
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5">
        <Avatar src={avatar} alt={otherUserName} sizeClassName="h-8 w-8 ring-2 ring-white/60" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{otherUserName}</p>
          <p className="flex items-center gap-1 text-[11px] text-sky-100">
            <MessageCircleMore className="h-3 w-3" /> Negotiation chat
          </p>
        </div>
        <button onClick={() => setIsOpen(false)} aria-label="Collapse chat" className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="max-h-60 space-y-2.5 overflow-y-auto bg-sky-50/40 p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <Sparkles className="h-5 w-5 text-sky-400" />
            <p className="text-xs font-medium text-gray-600">No messages yet</p>
            <p className="max-w-[220px] text-[11px] text-gray-500">
              Agree on the price, schedule, or details here — then use Counter or Accept above to make it official.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isSelf = m.sender_id === currentUserId;
            const showAvatar = !isSelf && (i === 0 || messages[i - 1].sender_id !== m.sender_id);
            return (
              <div key={m.id} className={`flex items-end gap-1.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                {!isSelf && (
                  <div className="h-5 w-5 shrink-0">
                    {showAvatar && <Avatar src={avatar} alt={otherUserName} sizeClassName="h-5 w-5" />}
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                    isSelf ? 'rounded-br-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-3 pt-2 text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex items-center gap-2 border-t border-sky-100 bg-white p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={`Message ${otherUserName}…`}
          className="min-w-0 flex-1 rounded-full border border-sky-100 bg-sky-50/50 px-4 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!draft.trim() || isSending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
