import { supabase } from './supabase';
import type { Database } from './supabase';
import {
  appendGroupRequestMeta,
  buildGroupRequestMeta,
  parseGroupRequestMeta,
  stripGroupRequestMeta,
} from './groupRequest';

type User = Database['public']['Tables']['users']['Row'];
type FreelancerProfile = Database['public']['Tables']['freelancer_profiles']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Favorite = Database['public']['Tables']['favorites']['Row'];

interface GroupConversationRow {
  id: string;
  title: string;
  created_by: string | null;
  related_group_request_id: string | null;
  last_message_at: string;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'freelancer' | 'client';
  location: string | null;
}

export interface MutualUserResult {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export class DataService {
  private static hasMissingLocationColumnError(error: unknown) {
    const message = (error as { message?: string } | null)?.message?.toLowerCase() || '';
    return (
      message.includes('location_latitude') ||
      message.includes('location_longitude') ||
      message.includes('location_place_id')
    );
  }

  private static async getAllFreelancersQuery(
    limit: number,
    offset: number,
    includeLocationColumns: boolean
  ) {
    const userFields = includeLocationColumns
      ? 'id, email, full_name, avatar_url, rating, total_reviews, location, location_latitude, location_longitude, location_place_id'
      : 'id, email, full_name, avatar_url, rating, total_reviews, location';

    return supabase
      .from('freelancer_profiles')
      .select(`*, users:user_id(${userFields})`)
      .eq('is_available', true)
      .limit(limit)
      .range(offset, offset + limit - 1);
  }

  private static getSearchFreelancersQuery(
    query: string,
    skills: string[] | undefined,
    includeLocationColumns: boolean
  ) {
    const userFields = includeLocationColumns
      ? 'id, email, full_name, avatar_url, rating, total_reviews, location, location_latitude, location_longitude, location_place_id'
      : 'id, email, full_name, avatar_url, rating, total_reviews, location';

    let q = supabase
      .from('freelancer_profiles')
      .select(`*, users:user_id(${userFields})`);

    if (query) {
      q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (skills && skills.length > 0) {
      q = q.overlaps('skills', skills);
    }

    return q.eq('is_available', true);
  }

  private static async getFreelancersByUserIds(
    userIds: string[],
    includeLocationColumns: boolean
  ) {
    if (!userIds.length) {
      return { data: [], error: null };
    }

    const userFields = includeLocationColumns
      ? 'id, email, full_name, avatar_url, rating, total_reviews, location, location_latitude, location_longitude, location_place_id'
      : 'id, email, full_name, avatar_url, rating, total_reviews, location';

    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select(`*, users:user_id(${userFields})`)
      .in('user_id', userIds)
      .eq('is_available', true);

    return { data, error };
  }

  // USERS
  static async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  }

  static async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    return { data, error };
  }

  static async searchUsers(query: string, options?: { excludeUserId?: string; limit?: number }) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return { data: [] as UserSearchResult[], error: null };
    }

    const limit = options?.limit ?? 12;

    let usersQuery = supabase
      .from('users')
      .select('id, email, full_name, avatar_url, role, location')
      .or(`full_name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%`)
      .limit(limit);

    if (options?.excludeUserId) {
      usersQuery = usersQuery.neq('id', options.excludeUserId);
    }

    const { data, error } = await usersQuery;
    return { data: (data || []) as UserSearchResult[], error };
  }

  static async getFollowingIds(userId: string) {
    const { data, error } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', userId);

    return {
      data: (data || []).map((row: any) => String(row.following_id)),
      error,
    };
  }

  static async getFollowCounts(userId: string) {
    const [followersResponse, followingResponse] = await Promise.all([
      supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    return {
      followerCount: followersResponse.count || 0,
      followingCount: followingResponse.count || 0,
      error: followersResponse.error || followingResponse.error,
    };
  }

  static async getMutualUsers(userId: string) {
    const [followingResponse, followersResponse] = await Promise.all([
      supabase.from('followers').select('following_id').eq('follower_id', userId),
      supabase.from('followers').select('follower_id').eq('following_id', userId),
    ]);

    if (followingResponse.error) {
      return { data: [] as MutualUserResult[], error: followingResponse.error };
    }

    if (followersResponse.error) {
      return { data: [] as MutualUserResult[], error: followersResponse.error };
    }

    const followingIds = new Set((followingResponse.data || []).map((row: any) => String(row.following_id)));
    const mutualIds = (followersResponse.data || [])
      .map((row: any) => String(row.follower_id))
      .filter((id: string) => followingIds.has(id));

    if (mutualIds.length === 0) {
      return { data: [] as MutualUserResult[], error: null };
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .in('id', mutualIds)
      .order('full_name', { ascending: true });

    return { data: (data || []) as MutualUserResult[], error };
  }

  static async isFollowing(userId: string, targetUserId: string) {
    const { data, error } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    return { isFollowing: !!data, error };
  }

  static async getFriendshipState(userId: string, targetUserId: string) {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { state: 'none' as const, pendingNotificationId: null, error: null };
    }

    const [followingResponse, followedByTargetResponse] = await Promise.all([
      this.isFollowing(userId, targetUserId),
      this.isFollowing(targetUserId, userId),
    ]);

    if (followingResponse.error || followedByTargetResponse.error) {
      return { state: 'none' as const, pendingNotificationId: null, error: followingResponse.error || followedByTargetResponse.error };
    }

    if (followingResponse.isFollowing && followedByTargetResponse.isFollowing) {
      return { state: 'friends' as const, pendingNotificationId: null, error: null };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, metadata')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .order('created_at', { ascending: false });

    if (error) {
      return { state: 'none' as const, pendingNotificationId: null, error };
    }

    const outgoingPending = (data || []).find((row: any) => String((row.metadata as any)?.requester_id || '') === userId);
    if (outgoingPending) {
      return { state: 'outgoing' as const, pendingNotificationId: outgoingPending.id, error: null };
    }

    const incomingResponse = await supabase
      .from('notifications')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'friend_request')
      .order('created_at', { ascending: false });

    if (incomingResponse.error) {
      return { state: 'none' as const, pendingNotificationId: null, error: incomingResponse.error };
    }

    const incomingPending = (incomingResponse.data || []).find((row: any) => String((row.metadata as any)?.requester_id || '') === targetUserId);
    if (incomingPending) {
      return { state: 'incoming' as const, pendingNotificationId: incomingPending.id, error: null };
    }

    return { state: 'none' as const, pendingNotificationId: null, error: null };
  }

  static async sendFriendRequest(userId: string, targetUserId: string) {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { error: null, alreadyPending: false };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, metadata')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .order('created_at', { ascending: false });

    if (!error) {
      const alreadyPending = (data || []).some((row: any) => String((row.metadata as any)?.requester_id || '') === userId);
      if (alreadyPending) {
        return { error: null, alreadyPending: true };
      }
    }

    const response = await this.createNotification({
      user_id: targetUserId,
      actor_id: userId,
      type: 'friend_request',
      title: 'New friend request',
      message: 'Sent you a friend request.',
      post_id: null,
      comment_id: null,
      related_id: null,
      metadata: { requester_id: userId, status: 'pending' },
      read: false,
    } as any);

    return { error: response.error, alreadyPending: false };
  }

  static async acceptFriendRequest(requesterUserId: string, targetUserId: string) {
    if (!requesterUserId || !targetUserId || requesterUserId === targetUserId) {
      return { error: null };
    }

    const pendingResponse = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .order('created_at', { ascending: false });

    if (!pendingResponse.error) {
      const pendingRequest = (pendingResponse.data || []).find((row: any) => String((row.metadata as any)?.requester_id || '') === requesterUserId);
      if (pendingRequest?.id) {
        await supabase.from('notifications').delete().eq('id', pendingRequest.id);
      }
    }

    const [followResponse, reverseFollowResponse] = await Promise.all([
      this.isFollowing(requesterUserId, targetUserId),
      this.isFollowing(targetUserId, requesterUserId),
    ]);

    if (!followResponse.isFollowing) {
      await this.followUser(requesterUserId, targetUserId);
    }

    if (!reverseFollowResponse.isFollowing) {
      await this.followUser(targetUserId, requesterUserId);
    }

    await this.createNotification({
      user_id: requesterUserId,
      actor_id: targetUserId,
      type: 'friend_request_accepted',
      title: 'Friend request accepted',
      message: 'Accepted your friend request.',
      post_id: null,
      comment_id: null,
      related_id: null,
      metadata: { requester_id: requesterUserId, status: 'accepted' },
      read: false,
    } as any);

    return { error: null };
  }

  static async denyFriendRequest(requesterUserId: string, targetUserId: string) {
    if (!requesterUserId || !targetUserId || requesterUserId === targetUserId) {
      return { error: null };
    }

    const pendingResponse = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .order('created_at', { ascending: false });

    if (!pendingResponse.error) {
      const pendingRequest = (pendingResponse.data || []).find((row: any) => String((row.metadata as any)?.requester_id || '') === requesterUserId);
      if (pendingRequest?.id) {
        await supabase.from('notifications').delete().eq('id', pendingRequest.id);
      }
    }

    await this.createNotification({
      user_id: requesterUserId,
      actor_id: targetUserId,
      type: 'friend_request_declined',
      title: 'Friend request declined',
      message: 'Declined your friend request.',
      post_id: null,
      comment_id: null,
      related_id: null,
      metadata: { requester_id: requesterUserId, status: 'declined' },
      read: false,
    } as any);

    return { error: null };
  }

  static async removeFriendship(userId: string, targetUserId: string) {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { error: null };
    }

    await Promise.all([
      this.unfollowUser(userId, targetUserId),
      this.unfollowUser(targetUserId, userId),
    ]);

    return { error: null };
  }

  static async followUser(userId: string, targetUserId: string) {
    const { error } = await supabase
      .from('followers')
      .insert({ follower_id: userId, following_id: targetUserId });

    return { error };
  }

  static async unfollowUser(userId: string, targetUserId: string) {
    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetUserId);

    return { error };
  }

  // FREELANCER PROFILES
  static async getFreelancerProfile(userId: string) {
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  }

  static async getFreelancerProfileById(profileId: string) {
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    return { data, error };
  }

  static async getAllFreelancers(limit = 20, offset = 0) {
    const firstAttempt = await this.getAllFreelancersQuery(limit, offset, true);
    if (firstAttempt.error && this.hasMissingLocationColumnError(firstAttempt.error)) {
      const fallbackAttempt = await this.getAllFreelancersQuery(limit, offset, false);
      return { data: fallbackAttempt.data, error: fallbackAttempt.error };
    }

    return { data: firstAttempt.data, error: firstAttempt.error };
  }

  static async searchFreelancers(query: string, skills?: string[]) {
    const trimmedQuery = query.trim();
    const firstAttempt = await this.getSearchFreelancersQuery(trimmedQuery, skills, true);
    let profileMatches = firstAttempt;

    if (firstAttempt.error && this.hasMissingLocationColumnError(firstAttempt.error)) {
      profileMatches = await this.getSearchFreelancersQuery(trimmedQuery, skills, false);
    }

    if (profileMatches.error) {
      return { data: profileMatches.data, error: profileMatches.error };
    }

    if (!trimmedQuery) {
      return { data: profileMatches.data, error: null };
    }

    const userMatches = await this.searchUsers(trimmedQuery, { limit: 24 });
    if (userMatches.error || !userMatches.data?.length) {
      return { data: profileMatches.data, error: null };
    }

    const existingIds = new Set((profileMatches.data || []).map((item: any) => String(item.user_id || item.users?.id || item.id)));
    const additionalIds = userMatches.data
      .map((item) => String(item.id))
      .filter((id) => !existingIds.has(id));

    if (!additionalIds.length) {
      return { data: profileMatches.data, error: null };
    }

    let additionalProfiles = await this.getFreelancersByUserIds(additionalIds, true);
    if (additionalProfiles.error && this.hasMissingLocationColumnError(additionalProfiles.error)) {
      additionalProfiles = await this.getFreelancersByUserIds(additionalIds, false);
    }

    if (additionalProfiles.error) {
      return { data: profileMatches.data, error: null };
    }

    return { data: [...(profileMatches.data || []), ...(additionalProfiles.data || [])], error: null };
  }

  static async createFreelancerProfile(userId: string, profile: Omit<FreelancerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .insert({ user_id: userId, ...profile })
      .select()
      .single();
    return { data, error };
  }

  static async updateFreelancerProfile(userId: string, updates: Partial<FreelancerProfile>) {
    const { data, error } = await supabase
      .from('freelancer_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  }

  static async updateUser(userId: string, updates: Partial<User>) {
    const firstAttempt = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (
      firstAttempt.error &&
      (Object.prototype.hasOwnProperty.call(updates, 'location_latitude') ||
        Object.prototype.hasOwnProperty.call(updates, 'location_longitude') ||
        Object.prototype.hasOwnProperty.call(updates, 'location_place_id'))
    ) {
      // If the DB schema is missing location columns, retry without them so onboarding can complete.
      const { location_latitude: _lat, location_longitude: _lng, location_place_id: _pid, ...safeUpdates } = updates as any;

      const fallbackAttempt = await supabase
        .from('users')
        .update(safeUpdates)
        .eq('id', userId)
        .select()
        .single();

      return { data: fallbackAttempt.data, error: fallbackAttempt.error };
    }

    const { data, error } = firstAttempt;

    if (
      error &&
      (error as any).message?.toLowerCase().includes("could not find the 'cover_url' column") &&
      Object.prototype.hasOwnProperty.call(updates, 'cover_url')
    ) {
      // Try fallback: remove cover_url and retry update to avoid blocking the UI when DB column is missing
      const { cover_url: _cv, ...safeUpdates } = updates as any;

      const fallbackAttempt = await supabase
        .from('users')
        .update(safeUpdates)
        .eq('id', userId)
        .select()
        .single();

      return { data: fallbackAttempt.data, error: fallbackAttempt.error };
    }

    return { data, error };
  }

  static async uploadUserProfileImage(userId: string, file: File, imageType: 'avatar' | 'cover') {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${imageType}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      return { publicUrl: null, error };
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return { publicUrl: data.publicUrl, error: null };
  }

  static async uploadPortfolioImage(userId: string, file: File) {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/portfolio-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      return { publicUrl: null, error };
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return { publicUrl: data.publicUrl, error: null };
  }

  // PORTFOLIOS
  static async getFreelancerPortfolio(freelancerId: string) {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('freelancer_id', freelancerId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async getPortfolioItem(portfolioId: string) {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single();
    return { data, error };
  }

  static async createPortfolioItem(freelancerId: string, portfolio: Omit<Portfolio, 'id' | 'freelancer_id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('portfolios')
      .insert({ freelancer_id: freelancerId, ...portfolio })
      .select()
      .single();
    return { data, error };
  }

  static async updatePortfolioItem(portfolioId: string, updates: Partial<Portfolio>) {
    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', portfolioId)
      .select()
      .single();
    return { data, error };
  }

  static async deletePortfolioItem(portfolioId: string) {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);
    return { error };
  }

  // BOOKINGS
  static async createBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single();
    return { data, error };
  }

  static async getClientBookings(clientId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, freelancer:freelancer_id(id, email, full_name, avatar_url)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async getFreelancerBookings(freelancerId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, client:client_id(id, email, full_name, avatar_url)')
      .eq('freelancer_id', freelancerId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async getBooking(bookingId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, freelancer:freelancer_id(id, email, full_name, avatar_url, rating, total_reviews, location), client:client_id(id, email, full_name, avatar_url, rating, total_reviews, location)')
      .eq('id', bookingId)
      .single();
    return { data, error };
  }

  static async updateBooking(bookingId: string, updates: Partial<Booking>) {
    const previous = await supabase
      .from('bookings')
      .select('id, client_id, freelancer_id, status, payment_status')
      .eq('id', bookingId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single();

    if (!error && data) {
      const previousStatus = String(previous.data?.status || '');
      const nextStatus = String((data as any).status || '');
      const previousPaymentStatus = String(previous.data?.payment_status || '');
      const nextPaymentStatus = String((data as any).payment_status || '');
      const clientId = String((data as any).client_id || previous.data?.client_id || '');
      const freelancerId = String((data as any).freelancer_id || previous.data?.freelancer_id || '');

      if (nextStatus && nextStatus !== previousStatus) {
        if (nextStatus === 'cancelled') {
          if (clientId) {
            await this.notifyEvent({
              userId: clientId,
              actorId: freelancerId || null,
              type: 'booking_cancelled',
              title: 'Booking cancelled',
              message: 'A booking was cancelled.',
              relatedId: bookingId,
            });
          }
          if (freelancerId) {
            await this.notifyEvent({
              userId: freelancerId,
              actorId: clientId || null,
              type: 'booking_cancelled',
              title: 'Booking cancelled',
              message: 'A booking was cancelled.',
              relatedId: bookingId,
            });
          }
        }

        if (nextStatus === 'completed' && clientId) {
          await this.notifyEvent({
            userId: clientId,
            actorId: freelancerId || null,
            type: 'booking_completed',
            title: 'Booking completion',
            message: 'Your booking has been marked completed.',
            relatedId: bookingId,
          });
        }
      }

      if (nextPaymentStatus && nextPaymentStatus !== previousPaymentStatus) {
        if (clientId) {
          await this.notifyEvent({
            userId: clientId,
            actorId: freelancerId || null,
            type: 'payment_update',
            title: 'Payment/deposit update',
            message: `Payment status is now ${nextPaymentStatus}.`,
            relatedId: bookingId,
            metadata: { payment_status: nextPaymentStatus },
          });
        }

        if (freelancerId && (nextPaymentStatus === 'paid' || nextPaymentStatus === 'released')) {
          await this.notifyEvent({
            userId: freelancerId,
            actorId: clientId || null,
            type: 'payment_released',
            title: 'Payment released',
            message: 'Payment was released for your booking.',
            relatedId: bookingId,
            metadata: { payment_status: nextPaymentStatus },
          });
        }
      }
    }

    return { data, error };
  }

  // MESSAGES
  static async getConversation(userId1: string, userId2: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(
        `and(participant_1_id.eq.${userId1},participant_2_id.eq.${userId2}),and(participant_1_id.eq.${userId2},participant_2_id.eq.${userId1})`
      )
      .single();
    return { data, error };
  }

  static async createConversation(participant1Id: string, participant2Id: string) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: participant1Id,
        participant_2_id: participant2Id,
      })
      .select()
      .single();
    return { data, error };
  }

  static async ensureConversation(participant1Id: string, participant2Id: string) {
    const existing = await this.getConversation(participant1Id, participant2Id);
    if (existing.data) {
      return existing;
    }

    return this.createConversation(participant1Id, participant2Id);
  }

  static async getUserGroupConversations(userId: string) {
    const { data, error } = await supabase
      .from('group_conversation_members')
      .select('conversation_id, group_conversations:conversation_id(*)')
      .eq('user_id', userId);

    if (error || !data) {
      return { data: [], error };
    }

    const conversations = (data || [])
      .map((row: any) => row.group_conversations)
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });

    return { data: conversations, error: null };
  }

  static async getGroupConversationMembers(conversationId: string) {
    const { data, error } = await supabase
      .from('group_conversation_members')
      .select('conversation_id, user_id, role, users:user_id(id, full_name, email, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true });

    return { data: data || [], error };
  }

  static async createGroupConversation(input: {
    title: string;
    createdBy: string;
    memberIds: string[];
    relatedGroupRequestId?: string;
  }) {
    const memberIds = Array.from(new Set(input.memberIds.filter(Boolean)));
    if (!memberIds.includes(input.createdBy)) {
      memberIds.push(input.createdBy);
    }

    const { data, error } = await supabase
      .from('group_conversations')
      .insert({
        title: input.title,
        created_by: input.createdBy,
        related_group_request_id: input.relatedGroupRequestId || null,
        last_message_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      return { data: null, error };
    }

    const { error: membersError } = await supabase
      .from('group_conversation_members')
      .insert(
        memberIds.map((userId) => ({
          conversation_id: data.id,
          user_id: userId,
          role: userId === input.createdBy ? 'owner' : 'member',
        }))
      );

    if (membersError) {
      return { data: null, error: membersError };
    }

    return { data: data as GroupConversationRow, error: null };
  }

  static async ensureGroupConversationForRequest(input: {
    groupRequestId: string;
    title: string;
    createdBy: string;
    memberIds: string[];
  }) {
    const existing = await supabase
      .from('group_conversations')
      .select('*')
      .eq('related_group_request_id', input.groupRequestId)
      .maybeSingle();

    if (existing.data) {
      return { data: existing.data as GroupConversationRow, error: null };
    }

    const created = await this.createGroupConversation({
      title: input.title,
      createdBy: input.createdBy,
      memberIds: input.memberIds,
      relatedGroupRequestId: input.groupRequestId,
    });

    if (!created.error || created.data) {
      return created;
    }

    const duplicate = String((created.error as any)?.message || '').toLowerCase().includes('duplicate');
    if (!duplicate) {
      return created;
    }

    const fallback = await supabase
      .from('group_conversations')
      .select('*')
      .eq('related_group_request_id', input.groupRequestId)
      .maybeSingle();

    return { data: (fallback.data as GroupConversationRow) || null, error: fallback.error };
  }

  static async getGroupMessages(conversationId: string, limit = 80) {
    const { data, error } = await supabase
      .from('group_messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  static async sendGroupMessage(input: {
    conversationId: string;
    senderId: string;
    content: string;
  }) {
    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        content: input.content,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { data, error };
    }

    await supabase
      .from('group_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', input.conversationId);

    const members = await this.getGroupConversationMembers(input.conversationId);
    const recipients = (members.data || [])
      .map((row: any) => String(row.user_id))
      .filter((id: string) => id && id !== input.senderId);

    for (const recipientId of recipients) {
      await this.notifyEvent({
        userId: recipientId,
        actorId: input.senderId,
        type: 'group_message',
        title: 'New group message',
        message: 'You received a new message in a group chat.',
        relatedId: input.conversationId,
        metadata: { conversation_id: input.conversationId, is_group: true },
      });
    }

    return { data, error: null };
  }

  static async getMessages(conversationId: string, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  }

  static async getClientPostPreviews(postIds: string[]) {
    if (!postIds.length) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('client_posts')
      .select('id, caption, image_url, client_id, client:client_id(id, full_name, avatar_url)')
      .in('id', postIds);

    return { data: data || [], error };
  }

  static async getClientPostsByAuthors(authorIds: string[]) {
    if (!authorIds.length) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('client_posts')
      .select('id, caption, image_url, client_id, created_at, client:client_id(id, full_name, avatar_url)')
      .in('client_id', authorIds)
      .order('created_at', { ascending: false })
      .limit(200);

    return { data: data || [], error };
  }

  static async getMessageReactions(messageIds: string[]) {
    if (!messageIds.length) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, reaction')
      .in('message_id', messageIds);

    const relationMissing = (err: any) => {
      const message = String(err?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    if (error && relationMissing(error)) {
      return { data: [], error: null };
    }

    return { data: data || [], error };
  }

  static async setMessageReaction(userId: string, messageId: string, reaction: string) {
    const relationMissing = (err: any) => {
      const message = String(err?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    const rlsDenied = (err: any) => {
      const message = String(err?.message || '').toLowerCase();
      return message.includes('row-level security policy') || err?.code === '42501';
    };

    const { data: existing, error: existingError } = await supabase
      .from('message_reactions')
      .select('id, reaction')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError && !relationMissing(existingError) && !rlsDenied(existingError)) {
      return { data: null, error: existingError };
    }

    if (existing && existing.reaction === reaction) {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id);

      if (error && !relationMissing(error) && !rlsDenied(error)) {
        return { data: null, error };
      }

      return { data: { removed: true }, error: null };
    }

    if (existing) {
      const { data, error } = await supabase
        .from('message_reactions')
        .update({ reaction })
        .eq('id', existing.id)
        .select('message_id, user_id, reaction')
        .single();

      if (error && !relationMissing(error) && !rlsDenied(error)) {
        return { data: null, error };
      }

      return { data, error: null };
    }

    const { data, error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: userId, reaction })
      .select('message_id, user_id, reaction')
      .single();

    if (error && !relationMissing(error) && !rlsDenied(error)) {
      return { data: null, error };
    }

    return { data, error: null };
  }

  static async sendMessage(message: Omit<Message, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single();
    
    // Update conversation last message time
    if (!error && data) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', data.conversation_id);

      await this.notifyEvent({
        userId: String(data.recipient_id),
        actorId: String(data.sender_id),
        type: 'message',
        title: 'New message',
        message: 'You received a new message.',
        relatedId: String(data.conversation_id),
        metadata: { conversation_id: data.conversation_id },
      });
    }

    return { data, error };
  }

  static async markMessagesAsRead(conversationId: string, userId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('recipient_id', userId);
    return { error };
  }

  static async getUserConversations(userId: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, participant_1:participant_1_id(id, email, full_name, avatar_url), participant_2:participant_2_id(id, email, full_name, avatar_url)')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });
    return { data, error };
  }

  // FAVORITES
  static async addFavorite(userId: string, freelancerId: string) {
    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, freelancer_id: freelancerId })
      .select()
      .single();

    const message = (error as any)?.message?.toLowerCase?.() || '';
    if (error && message.includes('row-level security policy')) {
      return {
        data: null,
        error: {
          message:
            'Favorites insert blocked by RLS policy. Run the favorites RLS migration SQL in supabase/schema.sql, then try again.',
        } as any,
      };
    }

    return { data, error };
  }

  static async removeFavorite(userId: string, freelancerId: string) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('freelancer_id', freelancerId);
    return { error };
  }

  static async getUserFavorites(userId: string) {
    const favoritesResponse = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (favoritesResponse.error || !favoritesResponse.data?.length) {
      return { data: favoritesResponse.data || [], error: favoritesResponse.error };
    }

    const freelancerIds = Array.from(
      new Set(favoritesResponse.data.map((item: any) => item.freelancer_id).filter(Boolean))
    );

    const [usersResponse, profilesResponse] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, avatar_url, rating, total_reviews, location')
        .in('id', freelancerIds),
      supabase
        .from('freelancer_profiles')
        .select('*')
        .in('user_id', freelancerIds),
    ]);

    if (usersResponse.error) {
      return { data: [], error: usersResponse.error };
    }

    if (profilesResponse.error) {
      return { data: [], error: profilesResponse.error };
    }

    const usersById = new Map((usersResponse.data || []).map((item: any) => [item.id, item]));
    const profilesByUserId = new Map((profilesResponse.data || []).map((item: any) => [item.user_id, item]));

    const data = favoritesResponse.data.map((favorite: any) => {
      const profile = profilesByUserId.get(favorite.freelancer_id) || {};
      const profileUser = usersById.get(favorite.freelancer_id) || null;

      return {
        ...favorite,
        freelancer: {
          ...profile,
          user_id: favorite.freelancer_id,
          users: profileUser,
        },
      };
    });

    return { data, error: null };
  }

  static async isFavorited(userId: string, freelancerId: string) {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('freelancer_id', freelancerId)
      .single();
    return { isFavorited: !!data, error };
  }

  // NOTIFICATIONS
  static async getUserNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const unreadOnly = options?.unreadOnly ?? false;
    const limit = options?.limit ?? 30;

    let query = supabase
      .from('notifications')
      .select('*, actor:actor_id(id, full_name, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (!error) {
      return { data, error: null };
    }

    const message = String((error as any)?.message || '').toLowerCase();
    const missingActorColumn = message.includes('actor_id') && (message.includes('does not exist') || message.includes('schema cache'));

    if (!missingActorColumn) {
      return { data: null, error };
    }

    let fallbackQuery = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      fallbackQuery = fallbackQuery.eq('read', false);
    }

    const fallback = await fallbackQuery;
    return { data: fallback.data || [], error: fallback.error };
  }

  static async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    return { error };
  }

  static async markAllNotificationsAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    return { error };
  }

  static async createNotification(notification: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>) {
    const rpcPayload = {
      target_user_id: notification.user_id,
      actor_user_id: notification.actor_id || notification.user_id,
      notification_kind: notification.type,
      notification_title: notification.title,
      notification_message: notification.message || null,
      notification_post_id: notification.post_id || null,
      notification_comment_id: notification.comment_id || null,
      notification_metadata: notification.metadata || {},
    };

    const rpcResult = await supabase.rpc('create_social_notification', rpcPayload);
    if (!rpcResult.error) {
      return { data: null, error: null };
    }

    const legacyRpc = await supabase.rpc('create_app_notification', {
      target_user_id: notification.user_id,
      notification_kind: notification.type,
      notification_title: notification.title,
      notification_message: notification.message || null,
      notification_related_id: notification.related_id || notification.post_id || notification.comment_id || null,
    });

    if (!legacyRpc.error) {
      return { data: null, error: null };
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        actor_id: notification.actor_id || null,
        type: notification.type,
        title: notification.title,
        message: notification.message || null,
        related_id: notification.related_id || notification.post_id || notification.comment_id || null,
        post_id: notification.post_id || null,
        comment_id: notification.comment_id || null,
        metadata: notification.metadata || {},
        read: notification.read ?? false,
      })
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const errorMessage = String((error as any)?.message || '').toLowerCase();
    const missingExtendedColumn = (
      ['actor_id', 'post_id', 'comment_id', 'metadata']
        .some((column) => errorMessage.includes(column))
    ) && (errorMessage.includes('does not exist') || errorMessage.includes('schema cache'));

    if (!missingExtendedColumn) {
      return { data: null, error };
    }

    const minimalInsert = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message || null,
        related_id: notification.related_id || notification.post_id || notification.comment_id || null,
        read: notification.read ?? false,
      } as any)
      .select()
      .single();

    return { data: minimalInsert.data, error: minimalInsert.error || null };
  }

  private static async notifyEvent(args: {
    userId: string;
    actorId?: string | null;
    type: string;
    title: string;
    message: string;
    relatedId?: string | null;
    metadata?: Record<string, any>;
  }) {
    if (!args.userId) {
      return { error: null };
    }

    const response = await this.createNotification({
      user_id: args.userId,
      actor_id: args.actorId || null,
      type: args.type,
      title: args.title,
      message: args.message,
      related_id: args.relatedId || null,
      post_id: null,
      comment_id: null,
      metadata: args.metadata || {},
      read: false,
    });

    return { error: response.error };
  }

  static async notifyTeamInvitation(inviteeUserId: string, inviterUserId: string, teamName: string) {
    return this.notifyEvent({
      userId: inviteeUserId,
      actorId: inviterUserId,
      type: 'team_invitation',
      title: 'Team invitation',
      message: `You were invited to join ${teamName}.`,
      metadata: { team_name: teamName },
    });
  }

  static async notifyTeamMemberJoined(targetUserId: string, joinedUserId: string, teamName: string) {
    return this.notifyEvent({
      userId: targetUserId,
      actorId: joinedUserId,
      type: 'team_member_joined',
      title: 'Team member joined',
      message: `A new member joined ${teamName}.`,
      metadata: { team_name: teamName },
    });
  }

  static async notifyAccountSecurityAlert(userId: string, message: string, severity: 'info' | 'warning' | 'critical' = 'info') {
    return this.notifyEvent({
      userId,
      type: 'account_security',
      title: 'Account/security alert',
      message,
      metadata: { severity },
    });
  }

  static async notifyAiMatchResults(userId: string, resultCount: number) {
    return this.notifyEvent({
      userId,
      type: 'ai_match_results',
      title: 'AI match results',
      message: `Your AI matcher found ${resultCount} freelancer${resultCount === 1 ? '' : 's'}.`,
      metadata: { results_count: resultCount },
    });
  }

  static async notifyPortfolioMatchedByAI(freelancerUserId: string, actorUserId: string | null) {
    return this.notifyEvent({
      userId: freelancerUserId,
      actorId: actorUserId,
      type: 'portfolio_matched_ai',
      title: 'Portfolio matched by AI',
      message: 'Your portfolio appeared in AI match results.',
      metadata: {},
    });
  }

  // REQUESTS
  static async createRequest(request: Omit<Database['public']['Tables']['requests']['Row'], 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('requests')
      .insert(request)
      .select()
      .single();

    const message = (error as any)?.message?.toLowerCase?.() || '';
    if (error && message.includes('row-level security policy')) {
      return {
        data: null,
        error: {
          message:
            'Request insert blocked by RLS policy. Ensure you are logged in and run the requests RLS migration SQL in supabase/schema.sql.',
        } as any,
      };
    }

    if (!error && request.freelancer_id && request.client_id) {
      await this.createNotification({
        user_id: request.freelancer_id,
        actor_id: request.client_id,
        type: 'request',
        title: 'New booking request',
        message: `New booking request: ${request.project_name}`,
        related_id: null,
        post_id: null,
        comment_id: null,
        metadata: {},
        read: false,
      });
    }

    return { data, error };
  }

  static async createBookingRequests(input: {
    clientId: string;
    recipientIds: string[];
    projectName: string;
    description: string;
    budget: number;
  }) {
    const recipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
    if (!recipients.length) {
      return { data: [], error: new Error('Please select at least one recipient.') };
    }

    const isGroup = recipients.length > 1;
    const groupMeta = isGroup ? buildGroupRequestMeta(input.clientId, recipients) : null;
    const payloadMessage = groupMeta
      ? appendGroupRequestMeta(input.description, groupMeta)
      : stripGroupRequestMeta(input.description);

    const created: any[] = [];
    for (const recipientId of recipients) {
      const response = await this.createRequest({
        client_id: input.clientId,
        freelancer_id: recipientId,
        project_name: input.projectName,
        description: payloadMessage,
        message: payloadMessage,
        budget: input.budget,
        status: 'pending',
      } as any);

      if (response.error) {
        return { data: created, error: response.error };
      }

      created.push(response.data);
    }

    return { data: created, error: null };
  }

  static getRequestGroupMeta(request: any) {
    return parseGroupRequestMeta(request?.message, request?.description);
  }

  static getRequestPlainMessage(request: any) {
    return stripGroupRequestMeta(request?.message || request?.description || '');
  }

  static async getClientRequestsWithProgress(clientId: string) {
    const response = await this.getClientRequests(clientId);
    if (response.error || !response.data) {
      return response;
    }

    const requests = response.data || [];
    const groups = new Map<string, { total: number; accepted: number }>();

    requests.forEach((request: any) => {
      const meta = this.getRequestGroupMeta(request);
      if (!meta?.group_id) {
        return;
      }

      if (!groups.has(meta.group_id)) {
        groups.set(meta.group_id, { total: 0, accepted: 0 });
      }
      const current = groups.get(meta.group_id)!;
      current.total += 1;
      if (request.status === 'accepted') {
        current.accepted += 1;
      }
    });

    const enriched = requests.map((request: any) => {
      const meta = this.getRequestGroupMeta(request);
      if (!meta?.group_id) {
        return {
          ...request,
          plain_message: this.getRequestPlainMessage(request),
          acceptance_progress: '0 out of 1 accepted',
          is_group_request: false,
        };
      }

      const stats = groups.get(meta.group_id) || { total: 1, accepted: 0 };
      return {
        ...request,
        plain_message: this.getRequestPlainMessage(request),
        group_meta: meta,
        acceptance_progress: `${stats.accepted} out of ${stats.total} accepted`,
        is_group_request: true,
      };
    });

    return { data: enriched, error: null };
  }

  static async updatePendingBookingRequest(input: {
    requestId: string;
    clientId: string;
    projectName: string;
    description: string;
    budget: number;
    recipientIds?: string[];
  }) {
    const currentResponse = await supabase
      .from('requests')
      .select('*')
      .eq('id', input.requestId)
      .eq('client_id', input.clientId)
      .single();

    if (currentResponse.error || !currentResponse.data) {
      return { data: null, error: currentResponse.error || new Error('Request not found.') };
    }

    const currentRequest = currentResponse.data;
    if (currentRequest.status !== 'pending') {
      return { data: null, error: new Error('Only pending requests can be edited.') };
    }

    const meta = this.getRequestGroupMeta(currentRequest);
    const requestedRecipients = Array.from(new Set((input.recipientIds || []).filter(Boolean)));

    if (!meta?.group_id) {
      const nextMessage = stripGroupRequestMeta(input.description);
      return this.updateRequest(input.requestId, {
        project_name: input.projectName,
        description: nextMessage,
        message: nextMessage,
        budget: input.budget,
      } as any);
    }

    const groupRequestsResponse = await supabase
      .from('requests')
      .select('*')
      .eq('client_id', input.clientId)
      .eq('status', 'pending');

    if (groupRequestsResponse.error) {
      return { data: null, error: groupRequestsResponse.error };
    }

    const groupRequests = (groupRequestsResponse.data || []).filter((request: any) => {
      const rowMeta = this.getRequestGroupMeta(request);
      return rowMeta?.group_id === meta.group_id;
    });

    const currentRecipients = new Set(groupRequests.map((request: any) => String(request.freelancer_id)));
    const desiredRecipients = new Set(requestedRecipients.length ? requestedRecipients : Array.from(currentRecipients));
    const mergedMeta = {
      ...meta,
      recipients: Array.from(desiredRecipients),
    };
    const nextMessage = appendGroupRequestMeta(input.description, mergedMeta as any);

    for (const request of groupRequests) {
      await this.updateRequest(request.id, {
        project_name: input.projectName,
        description: nextMessage,
        message: nextMessage,
        budget: input.budget,
      } as any);
    }

    for (const freelancerId of desiredRecipients) {
      if (currentRecipients.has(freelancerId)) {
        continue;
      }

      await this.createRequest({
        client_id: input.clientId,
        freelancer_id: freelancerId,
        project_name: input.projectName,
        description: nextMessage,
        message: nextMessage,
        budget: input.budget,
        status: 'pending',
      } as any);
    }

    for (const request of groupRequests) {
      if (desiredRecipients.has(String(request.freelancer_id))) {
        continue;
      }

      await supabase.from('requests').delete().eq('id', request.id).eq('status', 'pending');
    }

    return { data: { updated: true }, error: null };
  }

  static async getFreelancerRequests(freelancerId: string) {
    const { data, error } = await supabase
      .from('requests')
      .select('*, client:client_id(id, email, full_name, avatar_url)')
      .eq('freelancer_id', freelancerId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async getClientRequests(clientId: string) {
    const { data, error } = await supabase
      .from('requests')
      .select('*, freelancer:freelancer_id(id, email, full_name, avatar_url, location)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  // CLIENT POSTS (FOR YOU)
  static async getClientPosts(limit = 30) {
    const { data, error } = await supabase
      .from('client_posts')
      .select('*, client:client_id(id, email, full_name, avatar_url, location)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      return { data, error };
    }

    const enriched = await this.enrichClientPostsWithEngagement(data);
    return { data: enriched, error: null };
  }

  static async getClientPostsByClientId(clientId: string, limit = 20) {
    const { data, error } = await supabase
      .from('client_posts')
      .select('*, client:client_id(id, email, full_name, avatar_url, location)')
      .eq('client_id', clientId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      return { data, error };
    }

    const enriched = await this.enrichClientPostsWithEngagement(data);
    return { data: enriched, error: null };
  }

  private static async enrichClientPostsWithEngagement(posts: any[]) {
    const postIds = posts.map((post) => String(post.id));
    const statsResponse = await this.getClientPostEngagementStats(postIds);

    if (statsResponse.error || !statsResponse.data) {
      return posts;
    }

    const statsById = new Map(statsResponse.data.map((item: any) => [String(item.post_id), item]));

    return posts.map((post) => {
      const stats = statsById.get(String(post.id));
      return {
        ...post,
        likes_count: Math.max(Number(post.likes_count || 0), Number(stats?.likes || 0)),
        comments_count: Math.max(Number(post.comments_count || 0), Number(stats?.comments || 0)),
      };
    });
  }

  static async getClientPostLikeStats(postIds: string[], userId?: string) {
    if (postIds.length === 0) {
      return { data: [], error: null };
    }

    const [
      { data: likes, error: likesError },
      { data: comments, error: commentsError },
      { data: saves, error: savesError },
      { data: shares, error: sharesError },
    ] = await Promise.all([
      supabase
        .from('client_post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds),
      supabase
        .from('client_post_comments')
        .select('post_id')
        .in('post_id', postIds),
      supabase
        .from('client_post_saves')
        .select('post_id, user_id')
        .in('post_id', postIds),
      supabase
        .from('client_post_shares')
        .select('post_id')
        .in('post_id', postIds),
    ]);

    const relationMissing = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    if (likesError || commentsError) {
      return { data: null, error: likesError || commentsError };
    }

    if (savesError && !relationMissing(savesError)) {
      return { data: null, error: savesError };
    }

    if (sharesError && !relationMissing(sharesError)) {
      return { data: null, error: sharesError };
    }

    const likesByPost: Record<string, number> = {};
    const likedByMe: Record<string, boolean> = {};
    (likes || []).forEach((item: any) => {
      likesByPost[item.post_id] = (likesByPost[item.post_id] || 0) + 1;
      if (userId && item.user_id === userId) {
        likedByMe[item.post_id] = true;
      }
    });

    const commentsByPost: Record<string, number> = {};
    (comments || []).forEach((item: any) => {
      commentsByPost[item.post_id] = (commentsByPost[item.post_id] || 0) + 1;
    });

    const savesByPost: Record<string, number> = {};
    const savedByMe: Record<string, boolean> = {};
    (saves || []).forEach((item: any) => {
      savesByPost[item.post_id] = (savesByPost[item.post_id] || 0) + 1;
      if (userId && item.user_id === userId) {
        savedByMe[item.post_id] = true;
      }
    });

    const sharesByPost: Record<string, number> = {};
    (shares || []).forEach((item: any) => {
      sharesByPost[item.post_id] = (sharesByPost[item.post_id] || 0) + 1;
    });

    return {
      data: postIds.map((postId) => ({
        post_id: postId,
        likes: likesByPost[postId] || 0,
        comments: commentsByPost[postId] || 0,
        liked_by_me: !!likedByMe[postId],
        shares: sharesByPost[postId] || 0,
        saves: savesByPost[postId] || 0,
        saved_by_me: !!savedByMe[postId],
      })),
      error: null,
    };
  }

  static async getClientPostEngagementStats(postIds: string[], userId?: string) {
    return this.getClientPostLikeStats(postIds, userId);
  }

  static async toggleClientPostSave(userId: string, postId: string, currentlySaved: boolean) {
    const relationMissing = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    const rlsDenied = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('row-level security policy') || error?.code === '42501';
    };

    if (currentlySaved) {
      const { error } = await supabase
        .from('client_post_saves')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error && (relationMissing(error) || rlsDenied(error))) {
        return { saved: false, error: null };
      }

      return { saved: false, error };
    }

    const { error } = await supabase
      .from('client_post_saves')
      .insert({ user_id: userId, post_id: postId });

    if (error && error.code !== '23505' && !relationMissing(error) && !rlsDenied(error)) {
      return { saved: currentlySaved, error };
    }

    return { saved: true, error: null };
  }

  static async recordClientPostShare(userId: string, postId: string) {
    const relationMissing = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    const rlsDenied = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('row-level security policy') || error?.code === '42501';
    };

    const { data, error } = await supabase
      .from('client_post_shares')
      .insert({ user_id: userId, post_id: postId })
      .select()
      .single();

    if (error && (relationMissing(error) || rlsDenied(error))) {
      return { data: null, error: null };
    }

    return { data, error };
  }

  static async getClientPostComments(postId: string, limit = 40) {
    const { data, error } = await supabase
      .from('client_post_comments')
      .select('*, user:user_id(id, full_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);
    return { data, error };
  }

  static async getClientPostLikeUsers(postId: string) {
    const { data, error } = await supabase
      .from('client_post_likes')
      .select('user:user_id(id, full_name, email, avatar_url)')
      .eq('post_id', postId);

    const uniqueUsersById = new Map<string, any>();
    (data || []).forEach((row: any) => {
      const user = row?.user;
      if (!user?.id) {
        return;
      }
      uniqueUsersById.set(String(user.id), user);
    });

    return {
      data: Array.from(uniqueUsersById.values()),
      error,
    };
  }

  static async toggleClientPostLike(userId: string, postId: string, currentlyLiked: boolean) {
    if (currentlyLiked) {
      const { error } = await supabase
        .from('client_post_likes')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);
      return { liked: false, error };
    }

    const { data: existingLike, error: existingLikeError } = await supabase
      .from('client_post_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existingLikeError) {
      return { liked: currentlyLiked, error: existingLikeError };
    }

    if (existingLike) {
      return { liked: true, error: null };
    }

    const { data: postData } = await supabase
      .from('client_posts')
      .select('client_id')
      .eq('id', postId)
      .single();

    const { error } = await supabase
      .from('client_post_likes')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true });

    if (error) {
      return { liked: currentlyLiked, error };
    }

    if (postData?.client_id && postData.client_id !== userId) {
      await this.createNotification({
        user_id: postData.client_id,
        actor_id: userId,
        type: 'like',
        title: 'New like',
        message: 'Someone liked your post.',
        related_id: postId,
        post_id: postId,
        comment_id: null,
        metadata: {},
        read: false,
      });
    }

    return { liked: true, error: null };
  }

  static async addClientPostComment(userId: string, postId: string, content: string) {
    const { data, error } = await supabase
      .from('client_post_comments')
      .insert({
        user_id: userId,
        post_id: postId,
        content: content.trim(),
      })
      .select('*, user:user_id(id, full_name, avatar_url)')
      .single();

    if (!error) {
      const { data: postData } = await supabase
        .from('client_posts')
        .select('client_id')
        .eq('id', postId)
        .single();

      if (postData?.client_id && postData.client_id !== userId) {
        await this.createNotification({
          user_id: postData.client_id,
          actor_id: userId,
          type: 'comment',
          title: 'New comment',
          message: 'Someone commented on your post.',
          related_id: postId,
          post_id: postId,
          comment_id: data?.id || null,
          metadata: {},
          read: false,
        });
      }
    }

    return { data, error };
  }

  static async getActiveOrLatestBookingBetweenUsers(userAId: string, userBId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .or(`and(client_id.eq.${userAId},freelancer_id.eq.${userBId}),and(client_id.eq.${userBId},freelancer_id.eq.${userAId})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data, error };
  }

  static async completeBookingSession(bookingId: string) {
    return this.updateBooking(bookingId, {
      status: 'completed',
      updated_at: new Date().toISOString(),
    } as any);
  }

  static async hasReviewForBooking(bookingId: string, reviewerId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle();

    return { exists: !!data, error };
  }

  static async createReview(review: {
    booking_id: string;
    reviewer_id: string;
    reviewee_id: string;
    rating: number;
    comment?: string | null;
  }) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...review,
        comment: review.comment ?? null,
      })
      .select()
      .single();

    if (!error) {
      await this.notifyEvent({
        userId: review.reviewee_id,
        actorId: review.reviewer_id,
        type: 'review',
        title: 'New review',
        message: 'You received a new review.',
        relatedId: review.booking_id,
      });
    }

    return { data, error };
  }

  static async createClientPost(post: {
    client_id: string;
    caption: string;
    image_url?: string | null;
    is_published?: boolean;
  }) {
    const { data, error } = await supabase
      .from('client_posts')
      .insert({
        ...post,
        is_published: post.is_published ?? true,
      })
      .select('*, client:client_id(id, email, full_name, avatar_url, location)')
      .single();
    return { data, error };
  }

  static async deleteClientPost(postId: string, userId?: string) {
    let query = supabase.from('client_posts').delete().eq('id', postId);
    if (userId) {
      query = query.eq('client_id', userId);
    }

    const { data, error } = await query.select();
    return { data, error };
  }

  static async updateRequest(requestId: string, updates: Partial<Database['public']['Tables']['requests']['Row']>) {
    const previous = await supabase
      .from('requests')
      .select('id, client_id, freelancer_id, project_name, status')
      .eq('id', requestId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (!error && data) {
      const previousStatus = String(previous.data?.status || '');
      const nextStatus = String((data as any).status || '');
      const clientId = String((data as any).client_id || previous.data?.client_id || '');
      const freelancerId = String((data as any).freelancer_id || previous.data?.freelancer_id || '');
      const projectName = String((data as any).project_name || previous.data?.project_name || 'your request');

      if (nextStatus !== previousStatus) {
        if (nextStatus === 'accepted' && clientId) {
          await this.notifyEvent({
            userId: clientId,
            actorId: freelancerId || null,
            type: 'request_accepted',
            title: 'Booking accepted',
            message: `${projectName} was accepted.`,
            relatedId: requestId,
          });
        }

        if (nextStatus === 'rejected' && clientId) {
          await this.notifyEvent({
            userId: clientId,
            actorId: freelancerId || null,
            type: 'request_rejected',
            title: 'Booking rejected',
            message: `${projectName} was rejected.`,
            relatedId: requestId,
          });
        }

        if (nextStatus === 'cancelled') {
          if (clientId) {
            await this.notifyEvent({
              userId: clientId,
              actorId: freelancerId || null,
              type: 'booking_cancelled',
              title: 'Booking cancelled',
              message: `${projectName} was cancelled.`,
              relatedId: requestId,
            });
          }
          if (freelancerId) {
            await this.notifyEvent({
              userId: freelancerId,
              actorId: clientId || null,
              type: 'booking_cancelled',
              title: 'Booking cancelled',
              message: `${projectName} was cancelled.`,
              relatedId: requestId,
            });
          }
        }
      }
    }

    return { data, error };
  }
}
