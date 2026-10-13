export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PostShareMethod = 'copy_link' | 'native' | 'whatsapp' | 'facebook' | 'instagram' | 'x';
export type Gender = 'male' | 'female' | 'lgbtq_plus' | 'prefer_not_to_say';

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: Row<{
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          bio: string | null;
          role: 'freelancer' | 'client' | 'admin';
          gender: Gender | null;
          pronouns: string | null;
          preferred_currency: string | null;
          location: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_place_id: string | null;
          rating: number;
          total_reviews: number;
          client_type: string[] | null;
          client_interests: string[] | null;
          client_budget_preference: string | null;
          client_preferences: string[] | null;
          onboarding_completed: boolean;
          account_status?: 'active' | 'paused' | 'suspended' | 'banned';
          account_status_reason?: string | null;
          account_status_changed_at?: string | null;
          suspension_reason?: string | null;
          suspended_at?: string | null;
          suspension_expires_at?: string | null;
          suspended_by?: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['users']['Row']>;
        Update: Update<Database['public']['Tables']['users']['Row']>;
      };
      freelancer_profiles: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      portfolios: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      bookings: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      messages: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      favorites: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      notifications: {
        Row: Row<{
          id: string;
          user_id: string;
          actor_id: string | null;
          type: string;
          title: string;
          message: string | null;
          related_id: string | null;
          post_id: string | null;
          comment_id: string | null;
          metadata: Json;
          read: boolean;
          created_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['notifications']['Row']>;
        Update: Update<Database['public']['Tables']['notifications']['Row']>;
      };
      requests: {
        Row: Row<Record<string, any>>;
        Insert: Insert<Record<string, any>>;
        Update: Update<Record<string, any>>;
      };
      client_posts: {
        Row: Row<{
          id: string;
          client_id: string;
          caption: string;
          image_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['client_posts']['Row']>;
        Update: Update<Database['public']['Tables']['client_posts']['Row']>;
      };
      client_post_shares: {
        Row: Row<{
          id: string;
          post_id: string;
          user_id: string;
          share_method: PostShareMethod | null;
          created_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['client_post_shares']['Row']>;
        Update: Update<Database['public']['Tables']['client_post_shares']['Row']>;
      };
      followers: {
        Row: Row<{ id: string; follower_id: string; following_id: string; created_at: string }>;
        Insert: Insert<Database['public']['Tables']['followers']['Row']>;
        Update: Update<Database['public']['Tables']['followers']['Row']>;
      };
    };
  };
}
