import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Send } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../../lib/defaults';
import { AdminLayout } from './AdminLayout';

// A dedicated admin inbox, separate from the regular user-facing
// /messages page (MessagesPage.tsx) — that page is built around the
// social/booking messaging experience (group chats, booking sessions,
// request-to-follow gating) that doesn't apply here, and sending an admin
// there meant leaving the admin layout/chrome entirely. This only ever
// shows conversations the signed-in admin is personally a participant in —
// same conversations/messages RLS as everyone else (see
// supabase/conversations_messages_rls_hardening.sql), nothing admin-only
// about the data access, just a simpler, admin-shaped UI on top of it.
export function AdminMessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const openConversationWithUserId = (location.state as { openConversationWithUserId?: string } | null)?.openConversationWithUserId || null;

  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const otherParticipant = (conversation: any) => {
    if (!conversation || !user?.id) return null;
    return conversation.participant_1_id === user.id ? conversation.participant_2 : conversation.participant_1;
  };

  const loadConversations = async () => {
    if (!user?.id) return [];
    setIsLoadingList(true);
    setListError(null);
    const response = await DataService.getUserConversations(user.id);
    if (response.error) {
      setListError((response.error as any).message || 'Unable to load conversations.');
      setIsLoadingList(false);
      return [];
    }
    const list = response.data || [];
    setConversations(list);
    setIsLoadingList(false);
    return list;
  };

  // Deep-link support: AdminUsersPage.tsx / AdminUserDetailPage.tsx's
  // "Message" buttons navigate here with a target user id in router state
  // (never a URL param — an id in the URL would make a specific
  // conversation link shareable, which is exactly what prompted moving
  // this off the general /messages page in the first place).
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const list = await loadConversations();
      if (openConversationWithUserId) {
        const existing = list.find((c: any) => c.participant_1_id === openConversationWithUserId || c.participant_2_id === openConversationWithUserId);
        if (existing) {
          setSelectedId(existing.id);
        } else {
          const ensured = await DataService.ensureConversation(user.id, openConversationWithUserId, { forceAccepted: true });
          if (ensured.data) {
            const refreshed = await loadConversations();
            const created = refreshed.find((c: any) => c.id === ensured.data.id);
            setSelectedId(created?.id || ensured.data.id);
          }
        }
        // Clear the state so a later refresh/back-navigation doesn't
        // re-trigger this lookup.
        navigate(location.pathname, { replace: true, state: null });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedId || !user?.id) return;
    let isMounted = true;
    setIsLoadingThread(true);
    (async () => {
      const response = await DataService.getMessages(selectedId);
      if (!isMounted) return;
      setMessages((response.data || []).slice().reverse());
      setIsLoadingThread(false);
      await DataService.markMessagesAsRead(selectedId, user.id);
    })();

    const channel = DataService.subscribeToMessages(selectedId, () => {
      void (async () => {
        const response = await DataService.getMessages(selectedId);
        if (!isMounted) return;
        setMessages((response.data || []).slice().reverse());
        await DataService.markMessagesAsRead(selectedId, user.id);
      })();
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [selectedId, user?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;
  const selectedOther = otherParticipant(selectedConversation);

  const handleSend = async () => {
    if (!user?.id || !selectedId || !selectedOther?.id || !reply.trim() || isSending) return;
    setIsSending(true);
    setSendError(null);
    const response = await DataService.sendMessage({
      conversation_id: selectedId,
      sender_id: user.id,
      recipient_id: selectedOther.id,
      content: reply.trim(),
      read: false,
    } as any);
    setIsSending(false);
    if (response.error) {
      setSendError((response.error as any).message || 'Unable to send message.');
      return;
    }
    setReply('');
    const refreshed = await DataService.getMessages(selectedId);
    setMessages((refreshed.data || []).slice().reverse());
    void loadConversations();
  };

  return (
    <AdminLayout section="messages" breadcrumb={[{ label: 'Messages' }]}>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]" style={{ minHeight: '60vh' }}>
        <div className="rounded-2xl border border-sky-100 bg-white p-3 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          <h2 className="mb-2 px-1 text-sm font-bold text-gray-900">Conversations</h2>
          {listError && <p className="px-1 text-xs text-red-600">{listError}</p>}
          {isLoadingList ? (
            <p className="px-1 text-sm text-gray-500">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="px-1 text-sm text-gray-500">No conversations yet. Message a user from their profile to start one.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => {
                const other = otherParticipant(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left ${
                      selectedId === c.id ? 'bg-sky-100' : 'hover:bg-sky-50'
                    }`}
                  >
                    <img src={other?.avatar_url || DEFAULT_AVATAR_URL} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{other?.full_name || 'Unnamed'}</p>
                      <p className="truncate text-xs text-gray-500">{other?.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-2xl border border-sky-100 bg-white p-4 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Select a conversation.</div>
          ) : (
            <>
              <button
                onClick={() => navigate(`/admin/users/${selectedOther?.id}`)}
                className="mb-3 flex items-center gap-2 border-b border-sky-100 pb-3 text-left hover:opacity-80"
              >
                <img src={selectedOther?.avatar_url || DEFAULT_AVATAR_URL} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-gray-900">{selectedOther?.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-gray-500">{selectedOther?.email}</p>
                </div>
              </button>

              <div ref={scrollRef} className="mb-3 flex-1 space-y-3 overflow-y-auto rounded-xl bg-sky-50/50 p-3" style={{ maxHeight: '48vh' }}>
                {isLoadingThread ? (
                  <p className="py-2 text-center text-xs text-gray-500">Loading...</p>
                ) : messages.length === 0 ? (
                  <p className="py-2 text-center text-xs text-gray-500">No messages yet.</p>
                ) : (
                  messages.map((m) => {
                    const isSelf = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            isSelf ? 'rounded-br-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p className={`mt-1 text-[10px] ${isSelf ? 'text-sky-100' : 'text-gray-400'}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {sendError && <p className="mb-2 text-xs font-semibold text-red-600">{sendError}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={`Message ${selectedOther?.full_name || 'this user'}…`}
                  rows={1}
                  className="min-h-[38px] flex-1 resize-none rounded-lg border border-sky-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!reply.trim() || isSending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
