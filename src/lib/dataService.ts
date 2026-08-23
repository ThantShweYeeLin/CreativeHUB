import { hasSupabaseConfig, supabase } from './supabase';
import type { Database } from './supabase';

type User = Database['public']['Tables']['users']['Row'];
type FreelancerProfile = Database['public']['Tables']['freelancer_profiles']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Favorite = Database['public']['Tables']['favorites']['Row'];

export class DataService {
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

  // FREELANCER PROFILES
  static async getFreelancerProfile(userId: string) {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.') };
    }

    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*, users:user_id(id, email, full_name, avatar_url, rating, total_reviews, location), portfolios(*)')
      .eq('user_id', userId)
      .single();
    return { data, error };
  }

  static async getFreelancerById(id: string) {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.') };
    }

    const { data, error } = await supabase
      .from('freelancer_profiles')
      .select('*, users:user_id(id, email, full_name, avatar_url, rating, total_reviews, location), portfolios(*)')
      .eq('id', id)
      .single();
    return { data, error };
  }

  static async getAllFreelancers(limit?: number, offset = 0) {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.') };
    }

    let query = supabase
      .from('freelancer_profiles')
      .select('*, users:user_id(id, email, full_name, avatar_url, rating, total_reviews, location), portfolios(*)')
      .order('created_at', { ascending: false });

    if (typeof limit === 'number') {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    return { data, error };
  }

  static async searchFreelancers(query: string, skills?: string[]) {
    const cleaned = typeof query === 'string' ? query.trim() : '';
    const stripDiacritics = (s: string) => s.normalize ? s.normalize('NFD').replace(/\p{Diacritic}/gu, '') : s;
    const normQuery = stripDiacritics(cleaned).replace(/\s+/g, '').toLowerCase();

    // 1) Find users matching the query (case-insensitive, ignore spaces by normalizing client-side)
    let matchedUsers: Array<{ id: string; full_name?: string; email?: string }> = [];
    if (cleaned) {
      const usersResp = await supabase
        .from('users')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${cleaned}%,email.ilike.%${cleaned}%`)
        .limit(1000);

      const users = (usersResp.data || []) as Array<{ id: string; full_name?: string; email?: string }>;

      matchedUsers = users.filter((u) => {
        const rawName = u.full_name || '';
        const name = stripDiacritics(rawName).replace(/\s+/g, '').toLowerCase();
        const emailLocal = stripDiacritics((u.email || '').split('@')[0]).replace(/\s+/g, '').toLowerCase();

        // initials, e.g., John Doe -> jd
        const initials = (rawName || '')
          .split(/\s+/)
          .map((p) => p[0] || '')
          .join('')
          .toLowerCase();

        return (
          (name && name.includes(normQuery)) ||
          (emailLocal && emailLocal.includes(normQuery)) ||
          ((u.email || '').toLowerCase().includes(cleaned.toLowerCase())) ||
          (initials && initials.includes(normQuery))
        );
      });
    }

    // 2) Fetch freelancer profiles that either belong to matched users or match title/description
    const userIds = matchedUsers.map((u) => u.id).filter(Boolean);

    const profilesByUser = userIds.length > 0
      ? await supabase.from('freelancer_profiles').select('*, users:user_id(id, email, full_name, avatar_url, rating, total_reviews, location)').in('user_id', userIds)
      : { data: [] };

    const profilesByText = cleaned
      ? await supabase.from('freelancer_profiles').select('*, users:user_id(id, email, full_name, avatar_url, rating, total_reviews, location)').or(`title.ilike.%${cleaned}%,description.ilike.%${cleaned}%`).eq('is_available', true).limit(1000)
      : { data: [] };

    const combined = ([...(profilesByUser.data || []), ...(profilesByText.data || [])] as any[])
      .filter(Boolean)
      .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);

    // 3) For matched users who don't have a freelancer profile, synthesize a minimal profile so they can be found
    const profilesUserIds = new Set((combined as any[]).map((p) => p.user_id));
    for (const u of matchedUsers) {
      if (!profilesUserIds.has(u.id)) {
        combined.push({
          id: `user-${u.id}`,
          user_id: u.id,
          title: '',
          description: '',
          is_available: false,
          users: { id: u.id, email: u.email, full_name: u.full_name },
        });
      }
    }

    // 4) Optionally filter by skills if provided
    let finalResults = combined;
    if (skills && skills.length > 0) {
      finalResults = finalResults.filter((p: any) => {
        const s = p.skills || [];
        return Array.isArray(s) && skills.every((sk) => s.includes(sk));
      });
    }

    return { data: finalResults, error: null };
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
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
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
      .select('*')
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
    const { data, error } = await supabase
      .from('favorites')
      .select('*, freelancer:freelancer_id(*, users:user_id(id, email, full_name, avatar_url, rating))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
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
  static async getUserNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    return { error };
  }

  static async createNotification(notification: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    return { data, error };
  }

  // REQUESTS
  static async createRequest(request: Omit<Database['public']['Tables']['requests']['Row'], 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('requests')
      .insert(request)
      .select()
      .single();
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
