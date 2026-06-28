import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MessageCircle, Search, Send } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';

interface MessagesPageProps {
  onBack: () => void;
}

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

export function MessagesPage({ onBack }: MessagesPageProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      if (!user?.id) {
        if (isMounted) {
          setConversations([]);
          setIsLoadingConversations(false);
        }
        return;
      }

      setIsLoadingConversations(true);
      setError(null);

      const response = await DataService.getUserConversations(user.id);
      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load conversations.');
        setConversations([]);
      } else {
        const items = response.data || [];
        setConversations(items);
        setSelectedConversationId((current) =>
          current && items.some((item: any) => item.id === current) ? current : items[0]?.id ?? null
        );
      }

      setIsLoadingConversations(false);
    }

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!selectedConversationId || !user?.id) {
        if (isMounted) {
          setMessages([]);
        }
        return;
      }

      setIsLoadingMessages(true);
      const response = await DataService.getMessages(selectedConversationId, 100);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load messages.');
        setMessages([]);
      } else {
        const items = [...(response.data || [])].reverse();
        setMessages(items);
        await DataService.markMessagesAsRead(selectedConversationId, user.id);
      }

      setIsLoadingMessages(false);
    }

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [selectedConversationId, user?.id]);

  const normalizedConversations = useMemo(() => {
    return conversations
      .map((conversation) => {
        const participant1 = conversation.participant_1;
        const participant2 = conversation.participant_2;
        const otherParticipant = participant1?.id === user?.id ? participant2 : participant1;

        return {
          id: conversation.id,
          otherParticipantId: otherParticipant?.id,
          name: otherParticipant?.full_name || otherParticipant?.email || 'CreativeHUB user',
          avatar: otherParticipant?.avatar_url || fallbackProfileImage,
          lastMessageAt: conversation.last_message_at,
        };
      })
      .filter((item) => !!item.otherParticipantId);
  }, [conversations, user?.id]);

  const selectedConversation =
    normalizedConversations.find((item) => item.id === selectedConversationId) || null;

  const filteredConversations = normalizedConversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSendMessage = async () => {
    if (
      !user?.id ||
      !selectedConversationId ||
      !selectedConversation?.otherParticipantId ||
      !messageInput.trim()
    ) {
      return;
    }

    setIsSending(true);
    setError(null);

    const response = await DataService.sendMessage({
      conversation_id: selectedConversationId,
      sender_id: user.id,
      recipient_id: selectedConversation.otherParticipantId,
      content: messageInput.trim(),
      read: false,
    } as any);

    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to send message.');
      setIsSending(false);
      return;
    }

    setMessages((current) => [...current, response.data]);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversationId
          ? { ...conversation, last_message_at: new Date().toISOString() }
          : conversation
      )
    );
    setMessageInput('');
    setIsSending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Messages</h1>
            <div className="text-sm text-gray-500">Group chat coming soon</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[360px_minmax(0,1fr)] h-[calc(100vh-220px)]">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations && (
                <div className="flex justify-center py-10">
                  <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
                </div>
              )}

              {!isLoadingConversations && filteredConversations.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-600">No conversations yet.</div>
              )}

              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full p-4 flex items-center gap-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversationId === conversation.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                    <ImageWithFallback
                      src={conversation.avatar}
                      alt={conversation.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{conversation.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleString()
                        : 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center p-10 text-center">
                <div>
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageCircle className="w-12 h-12 text-gray-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Select a Conversation</h3>
                  <p className="text-gray-600">Choose a conversation to read or send messages.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                    <ImageWithFallback
                      src={selectedConversation.avatar}
                      alt={selectedConversation.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{selectedConversation.name}</h2>
                    <p className="text-sm text-gray-600">Direct conversation</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                  {isLoadingMessages && (
                    <div className="flex justify-center py-10">
                      <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
                    </div>
                  )}

                  {!isLoadingMessages && messages.length === 0 && (
                    <div className="text-center text-sm text-gray-600">No messages yet. Start the conversation below.</div>
                  )}

                  {messages.map((message) => {
                    const isMine = message.sender_id === user?.id;
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-xl px-4 py-3 rounded-2xl ${
                            isMine
                              ? 'bg-gradient-to-r from-gray-900 to-black text-white rounded-tr-none'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none shadow-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className={`mt-2 text-xs ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
                            {message.created_at
                              ? new Date(message.created_at).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                    />
                    <button
                      onClick={() => void handleSendMessage()}
                      disabled={!messageInput.trim() || isSending}
                      className="p-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
