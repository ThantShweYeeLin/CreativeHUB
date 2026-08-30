import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, MessageCircle, Search, Send, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { Avatar } from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { dispatchClientPostUpdated, subscribeClientPostUpdated } from '../../lib/clientPostSync';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import type { Gender } from '../../lib/database.types';

interface MessagesPageProps {
  onBack: () => void;
  onViewProfile?: (id: string) => void;
}

const fallbackProfileImage = DEFAULT_AVATAR_URL;

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
  const location = useLocation();
  const [conversations, setConversations] = useState<any[]>([]);
  const [groupConversations, setGroupConversations] = useState<any[]>([]);
  const [groupMembersByConversationId, setGroupMembersByConversationId] = useState<Record<string, any[]>>({});
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
  const [isHandlingRequest, setIsHandlingRequest] = useState(false);
  const [isBlockingContact, setIsBlockingContact] = useState(false);
  const [messageReactionsById, setMessageReactionsById] = useState<Record<string, { counts: Record<string, number>; mine: string | null }>>({});
  const [sharedPostPreviewById, setSharedPostPreviewById] = useState<Record<string, { image_url: string | null; caption: string | null; avatar_url: string | null; author_name: string | null; author_gender?: Gender | null }>>({});
  const [sharedPostFallbackByMessageId, setSharedPostFallbackByMessageId] = useState<Record<string, { image_url: string | null; caption: string | null; avatar_url: string | null; author_name: string | null; author_gender?: Gender | null }>>({});
  const [zoomedSharedPost, setZoomedSharedPost] = useState<{
    authorName: string;
    authorId: string | null;
    authorAvatar: string;
    authorGender?: Gender | null;
    postId: string | null;
    imageUrl: string | null;
    caption: string;
  } | null>(null);
  const [sharedPostLikeUsers, setSharedPostLikeUsers] = useState<any[]>([]);
  const [sharedPostComments, setSharedPostComments] = useState<any[]>([]);
  const [isSharedPostLikesLoading, setIsSharedPostLikesLoading] = useState(false);
  const [isSharedPostCommentsLoading, setIsSharedPostCommentsLoading] = useState(false);
  const [showSharedPostLikes, setShowSharedPostLikes] = useState(false);
  const [sharedPostCommentDraft, setSharedPostCommentDraft] = useState('');
  const [isSubmittingSharedPostComment, setIsSubmittingSharedPostComment] = useState(false);
  const openConversationWithUserId = (location.state as { openConversationWithUserId?: string } | null)?.openConversationWithUserId || null;
  const isGroupConversationKey = (value: string | null) => !!value && value.startsWith('group:');
  const toGroupConversationKey = (conversationId: string) => `group:${conversationId}`;
  const fromGroupConversationKey = (value: string) => value.replace(/^group:/, '');

  const getClientPostId = (postId: string | null) => postId ? postId.replace(/^client-post-/, '') : null;

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
          setGroupConversations([]);
          setIsLoadingConversations(false);
        }
        return;
      }

      setIsLoadingConversations(true);
      setError(null);

      const [directResponse, groupResponse] = await Promise.all([
        DataService.getUserConversations(user.id),
        DataService.getUserGroupConversations(user.id),
      ]);
      if (!isMounted) {
        return;
      }

      if (directResponse.error || groupResponse.error) {
        setError((directResponse.error as any)?.message || (groupResponse.error as any)?.message || 'Unable to load conversations.');
        setConversations([]);
        setGroupConversations([]);
      } else {
        let directItems = directResponse.data || [];
        const groupItems = groupResponse.data || [];

        let preferredConversation = openConversationWithUserId
          ? directItems.find((conversation: any) => {
              const participant1Id = conversation.participant_1?.id;
              const participant2Id = conversation.participant_2?.id;
              return participant1Id === openConversationWithUserId || participant2Id === openConversationWithUserId;
            })
          : null;

        // Arriving here from "Message" on a request/counter-offer targets a
        // specific person, not "whichever conversation happens to be
        // first" - if there's no existing thread with them yet, create one
        // instead of silently falling back to an unrelated conversation.
        if (openConversationWithUserId && !preferredConversation && user?.id) {
          const ensured = await DataService.ensureConversation(user.id, openConversationWithUserId);
          if (isMounted && ensured.data) {
            const refreshed = await DataService.getUserConversations(user.id);
            if (isMounted && !refreshed.error) {
              directItems = refreshed.data || directItems;
              preferredConversation = directItems.find((conversation: any) => conversation.id === ensured.data.id);
            }
          }
        }

        if (!isMounted) {
          return;
        }

        setConversations(directItems);
        setGroupConversations(groupItems);

        setSelectedConversationId((current) => {
          const hasDirect = current && directItems.some((item: any) => item.id === current);
          const hasGroup = current && isGroupConversationKey(current) && groupItems.some((item: any) => item.id === fromGroupConversationKey(current));

          if (!openConversationWithUserId && (hasDirect || hasGroup)) {
            return current;
          }

          return preferredConversation?.id
            ?? directItems[0]?.id
            ?? (groupItems[0]?.id ? toGroupConversationKey(String(groupItems[0].id)) : null);
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

    async function loadGroupMembers() {
      if (!groupConversations.length) {
        if (isMounted) {
          setGroupMembersByConversationId({});
        }
        return;
      }

      const entries = await Promise.all(
        groupConversations.map(async (conversation) => {
          const response = await DataService.getGroupConversationMembers(String(conversation.id));
          return [String(conversation.id), response.data || []] as const;
        })
      );

      if (!isMounted) {
        return;
      }

      const next: Record<string, any[]> = {};
      entries.forEach(([conversationId, members]) => {
        next[conversationId] = members;
      });
      setGroupMembersByConversationId(next);
    }

    void loadGroupMembers();

    return () => {
      isMounted = false;
    };
  }, [groupConversations]);

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
      const isGroupConversation = isGroupConversationKey(selectedConversationId);
      const rawConversationId = isGroupConversation
        ? fromGroupConversationKey(selectedConversationId)
        : selectedConversationId;

      const response = isGroupConversation
        ? await DataService.getGroupMessages(rawConversationId, 100)
        : await DataService.getMessages(rawConversationId, 100);

      if (!isMounted) {
        return;
      }

      if (response.error) {
        setError((response.error as any).message || 'Unable to load messages.');
        setMessages([]);
      } else {
        const items = [...(response.data || [])].reverse();
        setMessages(items);
        if (!isGroupConversation) {
          await DataService.markMessagesAsRead(rawConversationId, user.id);

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
        } else {
          setMessageReactionsById({});
        }

        const postIds = items
          .map((item: any) => parseSharedPostMessage(String(item.content || ''))?.postId)
          .filter((value: any): value is string => !!value);

        const uniquePostIds = Array.from(new Set(postIds));
        if (uniquePostIds.length > 0) {
          const previewResponse = await DataService.getClientPostPreviews(uniquePostIds);
          if (!previewResponse.error) {
            const previewMap: Record<string, { image_url: string | null; caption: string | null; avatar_url: string | null; author_name: string | null; author_gender?: Gender | null }> = {};
            (previewResponse.data || []).forEach((row: any) => {
              previewMap[String(row.id)] = {
                image_url: row.image_url || null,
                caption: row.caption || null,
                avatar_url: row.client?.avatar_url || null,
                author_name: row.client?.full_name || null,
                author_gender: row.client?.gender || null,
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
            const fallbackByMessageId: Record<string, { image_url: string | null; caption: string | null; avatar_url: string | null; author_name: string | null; author_gender?: Gender | null }> = {};
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
                avatar_url: matched?.client?.avatar_url || null,
                author_name: matched?.client?.full_name || null,
                author_gender: matched?.client?.gender || null,
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

    async function loadSharedPostDetails() {
      if (!zoomedSharedPost?.postId) {
        setSharedPostLikeUsers([]);
        setSharedPostComments([]);
        setShowSharedPostLikes(false);
        return;
      }

      const clientPostId = getClientPostId(zoomedSharedPost.postId);
      if (!clientPostId) {
        return;
      }

      setIsSharedPostLikesLoading(true);
      setIsSharedPostCommentsLoading(true);
      setShowSharedPostLikes(false);

      const [likesResponse, commentsResponse] = await Promise.all([
        DataService.getClientPostLikeUsers(clientPostId),
        DataService.getClientPostComments(clientPostId, 100),
      ]);

      if (!isMounted) {
        return;
      }

      setSharedPostLikeUsers(likesResponse.error ? [] : likesResponse.data || []);
      setSharedPostComments(commentsResponse.error ? [] : commentsResponse.data || []);
      setIsSharedPostLikesLoading(false);
      setIsSharedPostCommentsLoading(false);
    }

    void loadSharedPostDetails();

    return () => {
      isMounted = false;
    };
  }, [zoomedSharedPost?.postId]);

  useEffect(() => {
    const unsubscribe = subscribeClientPostUpdated((postId) => {
      if (zoomedSharedPost?.postId && getClientPostId(zoomedSharedPost.postId) === postId) {
        void (async () => {
          const clientPostId = getClientPostId(zoomedSharedPost.postId);
          if (!clientPostId) {
            return;
          }

          const [likesResponse, commentsResponse] = await Promise.all([
            DataService.getClientPostLikeUsers(clientPostId),
            DataService.getClientPostComments(clientPostId, 100),
          ]);

          setSharedPostLikeUsers(likesResponse.error ? [] : likesResponse.data || []);
          setSharedPostComments(commentsResponse.error ? [] : commentsResponse.data || []);
        })();
      }
    });

    return unsubscribe;
  }, [zoomedSharedPost?.postId]);

  const handleSharedPostLike = async () => {
    if (!user?.id || !zoomedSharedPost?.postId) {
      return;
    }

    const clientPostId = getClientPostId(zoomedSharedPost.postId);
    if (!clientPostId) {
      return;
    }

    const liked = sharedPostLikeUsers.some((likedUser) => String(likedUser.id) === String(user.id));
    setIsSharedPostLikesLoading(true);
    const response = await DataService.toggleClientPostLike(user.id, clientPostId, liked);

    if (response.error) {
      setError((response.error as any).message || 'Unable to update like status.');
      setIsSharedPostLikesLoading(false);
      return;
    }

    const [likesResponse, commentsResponse] = await Promise.all([
      DataService.getClientPostLikeUsers(clientPostId),
      DataService.getClientPostComments(clientPostId, 100),
    ]);

    setSharedPostLikeUsers(likesResponse.error ? [] : likesResponse.data || []);
    setSharedPostComments(commentsResponse.error ? [] : commentsResponse.data || []);
    setIsSharedPostLikesLoading(false);
    dispatchClientPostUpdated(clientPostId);
  };

  const handleSharedPostCommentSubmit = async () => {
    if (!user?.id || !zoomedSharedPost?.postId) {
      return;
    }

    const clientPostId = getClientPostId(zoomedSharedPost.postId);
    const draft = sharedPostCommentDraft.trim();
    if (!clientPostId || !draft) {
      return;
    }

    setIsSubmittingSharedPostComment(true);
    const response = await DataService.addClientPostComment(user.id, clientPostId, draft);

    if (response.error) {
      setError((response.error as any).message || 'Unable to add comment.');
      setIsSubmittingSharedPostComment(false);
      return;
    }

    const [likesResponse, commentsResponse] = await Promise.all([
      DataService.getClientPostLikeUsers(clientPostId),
      DataService.getClientPostComments(clientPostId, 100),
    ]);

    setSharedPostLikeUsers(likesResponse.error ? [] : likesResponse.data || []);
    setSharedPostComments(commentsResponse.error ? [] : commentsResponse.data || []);
    setSharedPostCommentDraft('');
    setIsSubmittingSharedPostComment(false);
    dispatchClientPostUpdated(clientPostId);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadBookingSession() {
      if (!selectedConversationId || isGroupConversationKey(selectedConversationId)) {
        if (isMounted) {
          setBookingSession(null);
          setHasSubmittedReview(false);
        }
        return;
      }

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
        if (isGroupConversationKey(selectedConversationId)) {
          const groupId = fromGroupConversationKey(selectedConversationId);
          const conversation = groupConversations.find((item: any) => String(item.id) === groupId);
          if (!conversation) {
            return null;
          }

          const members = (groupMembersByConversationId[groupId] || []).filter((member: any) => String(member.user_id) !== String(user?.id));
          const coverMember = members[0]?.users;

          return {
            id: selectedConversationId,
            rawId: groupId,
            otherParticipantId: null,
            isGroup: true,
            name: conversation.title || 'Group chat',
            avatar: coverMember?.avatar_url || fallbackProfileImage,
            avatarGender: coverMember?.gender || null,
            memberCount: (groupMembersByConversationId[groupId] || []).length,
            lastMessageAt: conversation.last_message_at,
          };
        }

        const conversation = conversations.find((item: any) => item.id === selectedConversationId);
        if (!conversation) {
          return null;
        }

        const participant1 = conversation.participant_1;
        const participant2 = conversation.participant_2;
        const otherParticipant = participant1?.id === user?.id ? participant2 : participant1;
        const isRequestForMe = conversation.status === 'pending' && conversation.initiated_by !== user?.id;

        return {
          id: conversation.id,
          rawId: conversation.id,
          otherParticipantId: otherParticipant?.id,
          isGroup: false,
          name: otherParticipant?.full_name || otherParticipant?.email || 'CreativeHUB user',
          avatar: otherParticipant?.avatar_url || fallbackProfileImage,
          avatarGender: otherParticipant?.gender || null,
          memberCount: 2,
          lastMessageAt: conversation.last_message_at,
          status: conversation.status || 'accepted',
          isRequestForMe,
        };
      })()
    : null;

  const normalizedConversations = useMemo(() => {
    const directConversations = conversations
      .map((conversation) => {
        const participant1 = conversation.participant_1;
        const participant2 = conversation.participant_2;
        const otherParticipant = participant1?.id === user?.id ? participant2 : participant1;
        const isRequestForMe = conversation.status === 'pending' && conversation.initiated_by !== user?.id;

        return {
          id: conversation.id,
          rawId: conversation.id,
          isGroup: false,
          otherParticipantId: otherParticipant?.id,
          name: otherParticipant?.full_name || otherParticipant?.email || 'CreativeHUB user',
          avatar: otherParticipant?.avatar_url || fallbackProfileImage,
          avatarGender: otherParticipant?.gender || null,
          memberCount: 2,
          lastMessageAt: conversation.last_message_at,
          isRequestForMe,
        };
      })
      .filter((item) => !!item.otherParticipantId);

    const grouped = groupConversations.map((conversation: any) => {
      const conversationId = String(conversation.id);
      const members = groupMembersByConversationId[conversationId] || [];
      const coverMember = members.find((member: any) => String(member.user_id) !== String(user?.id))?.users;

      return {
        id: toGroupConversationKey(conversationId),
        rawId: conversationId,
        isGroup: true,
        otherParticipantId: null,
        name: conversation.title || 'Group chat',
        avatar: coverMember?.avatar_url || fallbackProfileImage,
        avatarGender: coverMember?.gender || null,
        memberCount: members.length,
        lastMessageAt: conversation.last_message_at,
        isRequestForMe: false,
      };
    });

    return [...directConversations, ...grouped].sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || 0).getTime();
      return bTime - aTime;
    });
  }, [conversations, groupConversations, groupMembersByConversationId, user?.id]);

  const showBookingSessionControls = !activeConversation?.isGroup && !!bookingSession && bookingSession.status !== 'completed';

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
  const filteredMessages = filteredConversations.filter((conversation) => !conversation.isRequestForMe);
  const filteredRequests = filteredConversations.filter((conversation) => conversation.isRequestForMe);

  const handleSendMessage = async () => {
    if (!user?.id || !selectedConversationId || !messageInput.trim()) {
      return;
    }

    setIsSending(true);
    setError(null);

    const trimmedMessage = messageInput.trim();
    const isGroupConversation = isGroupConversationKey(selectedConversationId);
    const rawConversationId = isGroupConversation
      ? fromGroupConversationKey(selectedConversationId)
      : selectedConversationId;

    const response = isGroupConversation
      ? await DataService.sendGroupMessage({
          conversationId: rawConversationId,
          senderId: user.id,
          content: trimmedMessage,
        })
      : await DataService.sendMessage({
          conversation_id: rawConversationId,
          sender_id: user.id,
          recipient_id: activeConversation?.otherParticipantId,
          content: trimmedMessage,
          read: false,
        } as any);

    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Unable to send message.');
      setIsSending(false);
      return;
    }

    setMessages((current) => [...current, response.data]);

    if (isGroupConversation) {
      setGroupConversations((current) =>
        current.map((conversation) =>
          String(conversation.id) === rawConversationId
            ? { ...conversation, last_message_at: new Date().toISOString() }
            : conversation
        )
      );
    } else {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === rawConversationId
            ? {
                ...conversation,
                last_message_at: new Date().toISOString(),
                ...(activeConversation?.isRequestForMe ? { status: 'accepted' } : {}),
              }
            : conversation
        )
      );
    }

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

  const removeActiveConversationFromList = () => {
    if (!selectedConversationId) {
      return;
    }
    setConversations((current) => current.filter((conversation) => conversation.id !== selectedConversationId));
    setSelectedConversationId(null);
  };

  const handleAcceptRequest = async () => {
    if (!selectedConversationId) {
      return;
    }

    setIsHandlingRequest(true);
    setError(null);
    const response = await DataService.acceptMessageRequest(selectedConversationId);
    if (response.error) {
      setError((response.error as any)?.message || 'Unable to accept this request.');
      setIsHandlingRequest(false);
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversationId ? { ...conversation, status: 'accepted' } : conversation
      )
    );
    setIsHandlingRequest(false);
  };

  const handleReportSpam = async () => {
    if (!user?.id || !activeConversation?.otherParticipantId) {
      return;
    }

    setIsHandlingRequest(true);
    setError(null);
    const response = await DataService.reportAndBlock(user.id, activeConversation.otherParticipantId, selectedConversationId);
    if (response.error) {
      setError((response.error as any)?.message || 'Unable to report this message.');
      setIsHandlingRequest(false);
      return;
    }

    removeActiveConversationFromList();
    setIsHandlingRequest(false);
  };

  const handleBlockContact = async () => {
    if (!user?.id || !activeConversation?.otherParticipantId) {
      return;
    }

    setIsBlockingContact(true);
    setError(null);
    const response = await DataService.blockUser(user.id, activeConversation.otherParticipantId);
    if (response.error) {
      setError((response.error as any)?.message || 'Unable to block this user.');
      setIsBlockingContact(false);
      return;
    }

    removeActiveConversationFromList();
    setIsBlockingContact(false);
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
            <div className="text-sm text-gray-500">Direct and group chats</div>
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

              {filteredRequests.length > 0 && (
                <div className="border-b border-gray-200">
                  <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Message Requests
                  </div>
                  {filteredRequests.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full p-4 flex items-center gap-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedConversationId === conversation.id ? 'bg-gray-50' : ''
                      }`}
                    >
                      <Avatar
                        src={conversation.avatar}
                        alt={conversation.name}
                        gender={conversation.avatarGender}
                        sizeClassName="w-12 h-12 ring-2 ring-white shadow-sm rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{conversation.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">Wants to message you</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredMessages.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full p-4 flex items-center gap-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversationId === conversation.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <Avatar
                    src={conversation.avatar}
                    alt={conversation.name}
                    gender={conversation.avatarGender}
                    sizeClassName="w-12 h-12 ring-2 ring-white shadow-sm rounded-full"
                  />
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
                        <Avatar
                          src={mutual.avatar_url || fallbackProfileImage}
                          alt={mutual.full_name || mutual.email}
                          gender={mutual.gender}
                          sizeClassName="h-10 w-10 ring-2 ring-white shadow-sm rounded-full"
                        />
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
                  <button
                    type="button"
                    onClick={() => {
                      if (activeConversation.otherParticipantId) {
                        onViewProfile?.(activeConversation.otherParticipantId);
                      }
                    }}
                    disabled={!activeConversation.otherParticipantId}
                    className="w-12 h-12 rounded-full transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-70"
                  >
                    <Avatar
                      src={activeConversation.avatar}
                      alt={activeConversation.name}
                      gender={activeConversation.avatarGender}
                      sizeClassName="w-full h-full ring-2 ring-white shadow-sm rounded-full"
                    />
                  </button>
                  <div>
                    <h2 className="font-bold text-gray-900">{activeConversation.name}</h2>
                    <p className="text-sm text-gray-600">
                      {activeConversation.isGroup
                        ? `${Math.max(0, Number(activeConversation.memberCount || 0))} members`
                        : 'Direct conversation'}
                    </p>
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
                  {!activeConversation?.isGroup && !activeConversation?.isRequestForMe && !showBookingSessionControls && (
                    <button
                      type="button"
                      onClick={() => void handleBlockContact()}
                      disabled={isBlockingContact}
                      className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                    >
                      {isBlockingContact ? 'Blocking...' : 'Block'}
                    </button>
                  )}
                </div>

                {!activeConversation?.isGroup && activeConversation?.isRequestForMe ? (
                  <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">{activeConversation.name}</span> wants to send you a message. Accept to chat, or report/block if this looks like spam.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAcceptRequest()}
                        disabled={isHandlingRequest}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                      >
                        {isHandlingRequest ? 'Working...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReportSpam()}
                        disabled={isHandlingRequest}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Report Spam
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBlockContact()}
                        disabled={isBlockingContact}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                      >
                        {isBlockingContact ? 'Blocking...' : 'Block'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!activeConversation?.isGroup && (bookingSession?.status === 'accepted' || bookingSession?.status === 'confirmed' || bookingSession?.status === 'in_progress') ? (
                  <div className="border-b border-green-200 bg-green-50 px-6 py-3 text-sm text-green-700">
                    You may now chat with this person.
                  </div>
                ) : null}

                {activeConversation?.isGroup ? (
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
                    Group members can chat and coordinate here.
                  </div>
                ) : !bookingSession && !activeConversation?.isRequestForMe ? (
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
                    Mutuals can chat directly here.
                  </div>
                ) : null}

                {!activeConversation?.isGroup && bookingSession?.status === 'completed' && (
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
                    const groupConversationMembers = activeConversation?.isGroup
                      ? (groupMembersByConversationId[String(activeConversation.rawId)] || [])
                      : [];
                    const senderMember = groupConversationMembers.find(
                      (member: any) => String(member.user_id) === String(message.sender_id)
                    );
                    const senderAvatar = activeConversation?.isGroup
                      ? (senderMember?.users?.avatar_url || null)
                      : (isMine ? user?.avatar_url || null : activeConversation?.avatar || null);
                    const senderGender = activeConversation?.isGroup
                      ? (senderMember?.users?.gender || null)
                      : (isMine ? user?.gender || null : activeConversation?.avatarGender || null);
                    const resolvedPreview = sharedPost?.imageUrl || sharedPost?.previewUrl || previewFromDb?.image_url || fallbackFromAuthorCaption?.image_url || null;
                    const resolvedCaption = sharedPost?.caption || previewFromDb?.caption || fallbackFromAuthorCaption?.caption || 'A post was shared with you.';
                    const resolvedAuthorAvatar =
                      previewFromDb?.avatar_url
                      || fallbackFromAuthorCaption?.avatar_url
                      || senderAvatar
                      || fallbackProfileImage;
                    const resolvedAuthorGender = previewFromDb?.author_gender ?? fallbackFromAuthorCaption?.author_gender ?? senderGender ?? null;
                    const resolvedAuthorName = sharedPost?.authorName || previewFromDb?.author_name || fallbackFromAuthorCaption?.author_name || 'Shared post';
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
                                  <button
                                    type="button"
                                    onClick={() => sharedPost.authorId && onViewProfile?.(sharedPost.authorId as string)}
                                    className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${isMine ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'} transition-opacity hover:opacity-80`}
                                  >
                                    <Avatar
                                      src={resolvedAuthorAvatar}
                                      alt={resolvedAuthorName}
                                      gender={resolvedAuthorGender}
                                      sizeClassName="h-full w-full rounded-full"
                                    />
                                  </button>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{resolvedAuthorName}</div>
                                    <div className={`truncate text-xs ${isMine ? 'text-slate-400' : 'text-gray-500'}`}>Shared post</div>
                                  </div>
                                </div>
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
                                    setZoomedSharedPost({
                                      authorName: resolvedAuthorName,
                                      authorId: sharedPost.authorId || null,
                                      authorAvatar: resolvedAuthorAvatar,
                                      authorGender: resolvedAuthorGender,
                                      postId: sharedPost.postId || null,
                                      imageUrl: resolvedPreview,
                                      caption: resolvedCaption,
                                    });
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

                          {!activeConversation?.isGroup && (
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
                          )}
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

          {zoomedSharedPost && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
                <button
                  type="button"
                  onClick={() => setZoomedSharedPost(null)}
                  className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 shadow"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="max-h-[60vh] overflow-hidden bg-gray-100">
                  {zoomedSharedPost.imageUrl ? (
                    <ImageWithFallback
                      src={zoomedSharedPost.imageUrl}
                      alt={zoomedSharedPost.caption || zoomedSharedPost.authorName}
                      className="max-h-[60vh] w-full object-contain"
                    />
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center bg-gray-100 px-6 text-center text-gray-500">
                      No preview available for this post.
                    </div>
                  )}
                </div>

                <div className="max-h-[35vh] overflow-y-auto p-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (zoomedSharedPost.authorId) {
                          onViewProfile?.(zoomedSharedPost.authorId);
                        }
                      }}
                      className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                    >
                      <Avatar
                        src={zoomedSharedPost.authorAvatar}
                        alt={zoomedSharedPost.authorName}
                        gender={zoomedSharedPost.authorGender}
                        sizeClassName="h-10 w-10 ring-2 ring-gray-200 rounded-full"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{zoomedSharedPost.authorName}</p>
                        <p className="text-xs text-gray-500">Shared post</p>
                      </div>
                    </button>
                  </div>

                  <p className="whitespace-pre-line text-sm text-gray-800">{zoomedSharedPost.caption}</p>

                  <div className="mt-4 flex items-center gap-4 border-y border-gray-200 py-3">
                    <button
                      type="button"
                      onClick={() => setShowSharedPostLikes((current) => !current)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"
                    >
                      <span className="text-lg leading-none">♥</span>
                      {isSharedPostLikesLoading ? 'Loading...' : `${sharedPostLikeUsers.length} likes`}
                    </button>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <MessageCircle className="h-5 w-5 text-gray-700" />
                      {isSharedPostCommentsLoading ? 'Loading...' : `${sharedPostComments.length} comments`}
                    </span>
                  </div>

                  {showSharedPostLikes ? (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                      <p className="mb-2 font-semibold text-gray-900">Liked by</p>
                      {sharedPostLikeUsers.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {sharedPostLikeUsers.map((likedUser) => (
                            <button
                              key={likedUser.id}
                              type="button"
                              onClick={() => onViewProfile?.(String(likedUser.id))}
                              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm transition hover:bg-gray-50"
                            >
                              <Avatar
                                src={likedUser.avatar_url || fallbackProfileImage}
                                alt={likedUser.full_name || likedUser.email || 'User'}
                                gender={likedUser.gender}
                                sizeClassName="h-8 w-8 rounded-full"
                              />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{likedUser.full_name || likedUser.email || 'Unknown'}</p>
                                <p className="text-xs text-gray-500">@{String(likedUser.email || '').split('@')[0]}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No likes yet.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Comments</p>
                    {isSharedPostCommentsLoading ? (
                      <p className="text-sm text-gray-500">Loading comments...</p>
                    ) : sharedPostComments.length === 0 ? (
                      <p className="text-sm text-gray-500">No comments yet.</p>
                    ) : (
                      sharedPostComments.map((comment) => (
                        <div key={comment.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                            <Avatar
                              src={comment.user?.avatar_url || fallbackProfileImage}
                              alt={comment.user?.full_name || 'User'}
                              gender={comment.user?.gender}
                              sizeClassName="h-6 w-6 rounded-full"
                              badgeSize="xs"
                            />
                            <span className="font-semibold text-gray-900">{comment.user?.full_name || 'User'}</span>
                            <span>•</span>
                            <span>{new Date(comment.created_at).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={sharedPostCommentDraft}
                      onChange={(event) => setSharedPostCommentDraft(event.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSharedPostCommentSubmit()}
                      disabled={isSubmittingSharedPostComment}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmittingSharedPostComment ? 'Sending...' : 'Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
