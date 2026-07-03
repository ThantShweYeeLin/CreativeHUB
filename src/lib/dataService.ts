import { supabase } from './supabase';
import type { Database } from './supabase';

type User = Database['public']['Tables']['users']['Row'];
type FreelancerProfile = Database['public']['Tables']['freelancer_profiles']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Favorite = Database['public']['Tables']['favorites']['Row'];

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
    const firstAttempt = await this.getSearchFreelancersQuery(query, skills, true);
    if (firstAttempt.error && this.hasMissingLocationColumnError(firstAttempt.error)) {
      const fallbackAttempt = await this.getSearchFreelancersQuery(query, skills, false);
      return { data: fallbackAttempt.data, error: fallbackAttempt.error };
    }

    return { data: firstAttempt.data, error: firstAttempt.error };
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
    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single();
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

  static async getMessages(conversationId: string, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
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
    return { data, error };
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

    return { data, error: error || rpcResult.error };
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
            'Request insert blocked by RLS policy. Ensure you are logged in as a client and run the requests RLS migration SQL in supabase/schema.sql.',
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

    if (currentlySaved) {
      const { error } = await supabase
        .from('client_post_saves')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error && relationMissing(error)) {
        return { saved: false, error: null };
      }

      return { saved: false, error };
    }

    const { error } = await supabase
      .from('client_post_saves')
      .insert({ user_id: userId, post_id: postId });

    if (error && error.code !== '23505' && !relationMissing(error)) {
      return { saved: currentlySaved, error };
    }

    return { saved: true, error: null };
  }

  static async recordClientPostShare(userId: string, postId: string) {
    const relationMissing = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('does not exist') || message.includes('schema cache');
    };

    const { data, error } = await supabase
      .from('client_post_shares')
      .insert({ user_id: userId, post_id: postId })
      .select()
      .single();

    if (error && relationMissing(error)) {
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

  static async toggleClientPostLike(userId: string, postId: string, currentlyLiked: boolean) {
    if (currentlyLiked) {
      const { error } = await supabase
        .from('client_post_likes')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);
      return { liked: false, error };
    }

    const { data: postData } = await supabase
      .from('client_posts')
      .select('client_id')
      .eq('id', postId)
      .single();

    const { error } = await supabase
      .from('client_post_likes')
      .insert({ user_id: userId, post_id: postId });

    if (error && error.code !== '23505') {
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

  static async updateRequest(requestId: string, updates: Partial<Database['public']['Tables']['requests']['Row']>) {
    const { data, error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();
    return { data, error };
  }
}
