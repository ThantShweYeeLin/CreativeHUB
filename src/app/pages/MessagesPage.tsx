import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ExternalLink, MessageCircle, Search, Send } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';

interface MessagesPageProps {
  onBack: () => void;
  onViewProfile?: (id: string) => void;
}

const fallbackProfileImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

function parseSharedPostMessage(content: string) {
  const trimmedContent = content.trim();

  if (trimmedContent.startsWith('SHARED_POST::')) {
    const rawPayload = trimmedContent.slice('SHARED_POST::'.length);
    try {
      const parsed = JSON.parse(rawPayload) as {
        postId?: string;
        authorName?: string;
        authorId?: string;
        shareUrl?: string;
        caption?: string;
        imageUrl?: string | null;
        image?: string | null;
        previewUrl?: string | null;
        mediaUrl?: string | null;
      };

      const parsedImage = parsed.imageUrl || parsed.image || parsed.previewUrl || parsed.mediaUrl || null;

      return {
        authorName: parsed.authorName || 'A post',
        postId: parsed.postId || null,
        shareUrl: parsed.shareUrl || '',
        caption: parsed.caption || '',
        authorId: parsed.authorId || null,
        imageUrl: parsedImage,
      };
    } catch {
      return null;
    }
  }

  if (!trimmedContent.toLowerCase().startsWith('shared a post from ')) {
    return null;
  }

  const lines = trimmedContent.split('\n').map((line) => line.trim());
  const firstLine = lines[0] || '';
  const shareUrl = lines[1] || '';
  let previewUrl: string | null = null;
  let captionStart = 2;

  if (lines[2] && lines[2].startsWith('http')) {
    previewUrl = lines[2];
    captionStart = 3;
  }

  while (captionStart < lines.length && lines[captionStart] === '') {
    captionStart += 1;
  }

  const caption = lines.slice(captionStart).join('\n').trim();
  const authorName = firstLine.replace(/^shared a post from\s+/i, '').replace(/:$/, '').trim();
  const profileMatch = shareUrl.match(/\/profile\/([^/?#]+)/i);

  return {
    authorName,
    postId: null,
    shareUrl,
    previewUrl,
    caption,
    authorId: profileMatch?.[1] || null,
    imageUrl: null,
  };
}

export function MessagesPage({ onBack, onViewProfile }: MessagesPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<any[]>([]);
  const [mutualUsers, setMutualUsers] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [bookingSession, setBookingSession] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageReactionsById, setMessageReactionsById] = useState<Record<string, { counts: Record<string, number>; mine: string | null }>>({});
  const [sharedPostPreviewById, setSharedPostPreviewById] = useState<Record<string, { image_url: string | null; caption: string | null }>>({});
  const [sharedPostFallbackByMessageId, setSharedPostFallbackByMessageId] = useState<Record<string, { image_url: string | null; caption: string | null }>>({});
  const openConversationWithUserId = (location.state as { openConversationWithUserId?: string } | null)?.openConversationWithUserId || null;

  useEffect(() => {
    let isMounted = true;

    async function loadMutualUsers() {
      if (!user?.id) {
        if (isMounted) {
          setMutualUsers([]);
        }
        return;
      }

      const response = await DataService.getMutualUsers(user.id);
      if (!isMounted) {
        return;
      }

      if (response.error) {
        setMutualUsers([]);
      } else {
        setMutualUsers(response.data || []);
      }
    }

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

        const preferredConversation = openConversationWithUserId
          ? items.find((conversation: any) => {
              const participant1Id = conversation.participant_1?.id;
              const participant2Id = conversation.participant_2?.id;
              return participant1Id === openConversationWithUserId || participant2Id === openConversationWithUserId;
            })
          : null;

        setSelectedConversationId((current) => {
          if (current && items.some((item: any) => item.id === current)) {
            return current;
          }

          return preferredConversation?.id ?? items[0]?.id ?? null;
        });
      }

      setIsLoadingConversations(false);
    }

    loadMutualUsers();
    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [openConversationWithUserId, user?.id]);

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

        const messageIds = items.map((item: any) => String(item.id));
        const reactionsResponse = await DataService.getMessageReactions(messageIds);
        if (!reactionsResponse.error) {
          const next: Record<string, { counts: Record<string, number>; mine: string | null }> = {};
          (reactionsResponse.data || []).forEach((row: any) => {
            const messageId = String(row.message_id);
            const emoji = String(row.reaction || '');
            if (!emoji) return;

            if (!next[messageId]) {
              next[messageId] = { counts: {}, mine: null };
            }

            next[messageId].counts[emoji] = (next[messageId].counts[emoji] || 0) + 1;
            if (String(row.user_id) === String(user.id)) {
              next[messageId].mine = emoji;
            }
          });
          setMessageReactionsById(next);
        }

        const postIds = items
          .map((item: any) => parseSharedPostMessage(String(item.content || ''))?.postId)
          .filter((value: any): value is string => !!value);

        const uniquePostIds = Array.from(new Set(postIds));
        if (uniquePostIds.length > 0) {
          const previewResponse = await DataService.getClientPostPreviews(uniquePostIds);
          if (!previewResponse.error) {
            const previewMap: Record<string, { image_url: string | null; caption: string | null }> = {};
            (previewResponse.data || []).forEach((row: any) => {
              previewMap[String(row.id)] = {
                image_url: row.image_url || null,
                caption: row.caption || null,
              };
            });
            setSharedPostPreviewById(previewMap);
          }
        }

        const authorIds = Array.from(
          new Set(
            items
              .map((item: any) => parseSharedPostMessage(String(item.content || ''))?.authorId)
              .filter((value: any): value is string => !!value)
          )
        );

        if (authorIds.length > 0) {
          const candidatesResponse = await DataService.getClientPostsByAuthors(authorIds);
          if (!candidatesResponse.error) {
            const fallbackByMessageId: Record<string, { image_url: string | null; caption: string | null }> = {};
            const candidates = candidatesResponse.data || [];

            items.forEach((item: any) => {
              const parsed = parseSharedPostMessage(String(item.content || ''));
              if (!parsed || parsed.postId || parsed.imageUrl || parsed.previewUrl || !parsed.authorId) {
                return;
              }

              const byAuthor = candidates.filter((row: any) => String(row.client_id) === String(parsed.authorId));
              if (!byAuthor.length) {
                return;
              }

              const normalizedCaption = String(parsed.caption || '').trim().toLowerCase();
              const exactMatch = normalizedCaption
                ? byAuthor.find((row: any) => String(row.caption || '').trim().toLowerCase() === normalizedCaption)
                : null;
              const matched = exactMatch || byAuthor[0];

              fallbackByMessageId[String(item.id)] = {
                image_url: matched?.image_url || null,
                caption: matched?.caption || null,
              };
            });

            setSharedPostFallbackByMessageId(fallbackByMessageId);
          }
        }
      }

      setIsLoadingMessages(false);
    }

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [selectedConversationId, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadBookingSession() {
      const selectedRawConversation = conversations.find((item: any) => item.id === selectedConversationId);
      const participant1 = selectedRawConversation?.participant_1;
      const participant2 = selectedRawConversation?.participant_2;
      const otherParticipantId = participant1?.id === user?.id ? participant2?.id : participant1?.id;

      if (!user?.id || !otherParticipantId) {
        if (isMounted) {
          setBookingSession(null);
          setHasSubmittedReview(false);
        }
        return;
      }

      const bookingResponse = await DataService.getActiveOrLatestBookingBetweenUsers(
        user.id,
        otherParticipantId
      );

      if (!isMounted) return;

      if (bookingResponse.error || !bookingResponse.data) {
        setBookingSession(null);
        setHasSubmittedReview(false);
        return;
      }

      setBookingSession(bookingResponse.data);

      if (bookingResponse.data.status === 'completed') {
        const reviewCheck = await DataService.hasReviewForBooking(bookingResponse.data.id, user.id);
        if (isMounted && !reviewCheck.error) {
          setHasSubmittedReview(reviewCheck.exists);
        }
      } else {
        setHasSubmittedReview(false);
      }
    }

    loadBookingSession();

    return () => {
      isMounted = false;
    };
  }, [selectedConversationId, conversations, user?.id]);

  const activeConversation = selectedConversationId
    ? (() => {
        const conversation = conversations.find((item: any) => item.id === selectedConversationId);
        if (!conversation) {
          return null;
        }

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
      })()
    : null;

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

  const showBookingSessionControls = !!bookingSession && bookingSession.status !== 'completed';

  const handleEndSession = async () => {
    if (!bookingSession?.id || !user?.id || !activeConversation?.otherParticipantId || !selectedConversationId) {
      return;
    }

    setIsEndingSession(true);
    setError(null);

    const response = await DataService.completeBookingSession(bookingSession.id);
    if (response.error) {
      setError((response.error as any).message || 'Unable to end this session.');
      setIsEndingSession(false);
      return;
    }

    await DataService.sendMessage({
      conversation_id: selectedConversationId,
      sender_id: user.id,
      recipient_id: activeConversation.otherParticipantId,
      content: 'Session ended. Booking marked as completed. Please leave a review for each other.',
      read: false,
    } as any);

    setBookingSession(response.data || { ...bookingSession, status: 'completed' });
    setIsEndingSession(false);
  };

  const handleSubmitReview = async () => {
    if (!bookingSession?.id || !user?.id || !activeConversation?.otherParticipantId) {
      return;
    }

    setIsSubmittingReview(true);
    setError(null);

    const reviewResponse = await DataService.createReview({
      booking_id: bookingSession.id,
      reviewer_id: user.id,
      reviewee_id: activeConversation.otherParticipantId,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });

    if (reviewResponse.error) {
      setError((reviewResponse.error as any).message || 'Unable to submit review.');
      setIsSubmittingReview(false);
      return;
    }

    setHasSubmittedReview(true);
    setReviewComment('');
    setIsSubmittingReview(false);
  };

  const filteredConversations = normalizedConversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSendMessage = async () => {
    if (
      !user?.id ||
      !selectedConversationId ||
      !activeConversation?.otherParticipantId ||
      !messageInput.trim()
    ) {
      return;
    }

    setIsSending(true);
    setError(null);

    const response = await DataService.sendMessage({
      conversation_id: selectedConversationId,
      sender_id: user.id,
      recipient_id: activeConversation.otherParticipantId,
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

  const reactionChoices = ['👍', '❤️', '😂', '😮', '😢'];

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!user?.id) {
      return;
    }

    const previous = messageReactionsById[messageId] || { counts: {}, mine: null };
    const nextCounts = { ...previous.counts };

    if (previous.mine) {
      nextCounts[previous.mine] = Math.max(0, (nextCounts[previous.mine] || 0) - 1);
      if (nextCounts[previous.mine] === 0) {
        delete nextCounts[previous.mine];
      }
    }

    const sameEmoji = previous.mine === emoji;
    if (!sameEmoji) {
      nextCounts[emoji] = (nextCounts[emoji] || 0) + 1;
    }

    setMessageReactionsById((current) => ({
      ...current,
      [messageId]: {
        counts: nextCounts,
        mine: sameEmoji ? null : emoji,
      },
    }));

    const response = await DataService.setMessageReaction(user.id, messageId, emoji);
    if (response.error) {
      setMessageReactionsById((current) => ({
        ...current,
        [messageId]: previous,
      }));
    }
  };

  const openMutualConversation = async (mutualUserId: string) => {
    if (!user?.id || !mutualUserId) {
      return;
    }

    setError(null);
    const response = await DataService.ensureConversation(user.id, mutualUserId);
    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to start conversation.');
      return;
    }

    setConversations((current) => {
      const existingIndex = current.findIndex((conversation: any) => conversation.id === response.data.id);
      if (existingIndex >= 0) {
        return current;
      }

      return [response.data, ...current];
    });
    setSelectedConversationId(response.data.id);
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
                <div className="p-6 text-center text-sm text-gray-600">No conversations yet. Pick a mutual below to start one.</div>
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

              {!searchQuery.trim() && mutualUsers.length > 0 && (
                <div className="border-t border-gray-200">
                  <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Mutuals</div>
                  {mutualUsers.map((mutual) => (
                    <button
                      key={mutual.id}
                      type="button"
                      onClick={() => void openMutualConversation(mutual.id)}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                          <ImageWithFallback
                            src={mutual.avatar_url || fallbackProfileImage}
                            alt={mutual.full_name || mutual.email}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-gray-900">{mutual.full_name || mutual.email}</h3>
                          <p className="truncate text-xs text-gray-500">Tap to message</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
            {!activeConversation ? (
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
                      src={activeConversation.avatar}
                      alt={activeConversation.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{activeConversation.name}</h2>
                    <p className="text-sm text-gray-600">Direct conversation</p>
                  </div>
                  {showBookingSessionControls && (
                    <button
                      type="button"
                      onClick={() => void handleEndSession()}
                      disabled={isEndingSession}
                      className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {isEndingSession ? 'Ending...' : 'End Session'}
                    </button>
                  )}
                </div>

                {bookingSession?.status === 'accepted' || bookingSession?.status === 'confirmed' || bookingSession?.status === 'in_progress' ? (
                  <div className="border-b border-green-200 bg-green-50 px-6 py-3 text-sm text-green-700">
                    You may now chat with this person.
                  </div>
                ) : null}

                {!bookingSession && (
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
                    Mutuals can chat directly here.
                  </div>
                )}

                {bookingSession?.status === 'completed' && (
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">Session completed</p>
                    {!hasSubmittedReview ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">Rating:</span>
                          <select
                            value={reviewRating}
                            onChange={(event) => setReviewRating(Number(event.target.value))}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                          >
                            {[5, 4, 3, 2, 1].map((value) => (
                              <option key={value} value={value}>{value} stars</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          placeholder="Write a short review"
                          className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSubmitReview()}
                          disabled={isSubmittingReview}
                          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                          {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">Thanks, your review has been submitted.</p>
                    )}
                  </div>
                )}

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
                    const sharedPost = parseSharedPostMessage(String(message.content || ''));
                    const sharedPostAuthorId = sharedPost?.authorId;
                    const sharedPostId = sharedPost?.postId || null;
                    const previewFromDb = sharedPostId ? sharedPostPreviewById[sharedPostId] : null;
                    const fallbackFromAuthorCaption = sharedPostFallbackByMessageId[String(message.id)] || null;
                    const resolvedPreview = sharedPost?.imageUrl || sharedPost?.previewUrl || previewFromDb?.image_url || fallbackFromAuthorCaption?.image_url || null;
                    const resolvedCaption = sharedPost?.caption || previewFromDb?.caption || fallbackFromAuthorCaption?.caption || 'A post was shared with you.';
                    const reactions = messageReactionsById[String(message.id)] || { counts: {}, mine: null };
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-xl px-4 py-3 rounded-2xl ${
                            isMine
                              ? 'bg-gradient-to-r from-gray-900 to-black text-white rounded-tr-none'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none shadow-sm'
                          }`}
                        >
                          {sharedPost && (
                            <div className={`mb-3 overflow-hidden rounded-3xl border shadow-lg ${isMine ? 'border-slate-700 bg-slate-950 text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
                              <div className="flex items-start justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${isMine ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    {sharedPost.authorName ? sharedPost.authorName.split(' ').map((part) => part[0]).slice(0, 2).join('') : 'P'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{sharedPost.authorName || 'Shared post'}</div>
                                    <div className={`truncate text-xs ${isMine ? 'text-slate-400' : 'text-gray-500'}`}>Shared post</div>
                                  </div>
                                </div>
                                {sharedPost.authorId && onViewProfile && (
                                  <button
                                    type="button"
                                    onClick={() => onViewProfile(sharedPost.authorId as string)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${isMine ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                  >
                                    View profile
                                  </button>
                                )}
                              </div>

                              <div className="px-4 pb-4">
                                <p className={`text-sm ${isMine ? 'text-white/90' : 'text-gray-800'} whitespace-pre-wrap`}>{resolvedCaption}</p>
                              </div>

                              {resolvedPreview ? (
                                <div className="relative overflow-hidden bg-slate-900">
                                  <ImageWithFallback
                                    src={resolvedPreview}
                                    alt={sharedPost.authorName || 'Shared post preview'}
                                    className="h-80 w-full object-cover"
                                  />
                                  {resolvedPreview?.match(/\.(mp4|mov|webm|ogg)(\?|$)/i) ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                      <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-900">
                                          <path d="M8 5v14l11-7z" fill="currentColor" />
                                        </svg>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-2 px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pid = sharedPost.postId || null;
                                    if (pid) {
                                      navigate('/for-you', { state: { openPostId: `client-post-${pid}` } });
                                    } else if (sharedPost.shareUrl) {
                                      window.location.href = sharedPost.shareUrl;
                                    }
                                  }}
                                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${isMine ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                >
                                  Open post
                                </button>
                                {sharedPost.authorId && onViewProfile && (
                                  <button
                                    type="button"
                                    onClick={() => onViewProfile(sharedPost.authorId as string)}
                                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${isMine ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                  >
                                    View profile
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {!sharedPost ? (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          ) : null}
                          <p className={`mt-2 text-xs ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
                            {message.created_at
                              ? new Date(message.created_at).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : ''}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {Object.entries(reactions.counts).map(([emoji, count]) => (
                              <button
                                key={`${message.id}-${emoji}`}
                                type="button"
                                onClick={() => void handleReactToMessage(String(message.id), emoji)}
                                className={`rounded-full border px-2 py-1 text-xs ${reactions.mine === emoji ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}
                              >
                                {emoji} {count}
                              </button>
                            ))}

                            {reactionChoices.map((emoji) => (
                              <button
                                key={`${message.id}-add-${emoji}`}
                                type="button"
                                onClick={() => void handleReactToMessage(String(message.id), emoji)}
                                className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
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
                      disabled={!activeConversation}
                      className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                    <button
                      onClick={() => void handleSendMessage()}
                      disabled={!activeConversation || !messageInput.trim() || isSending}
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
