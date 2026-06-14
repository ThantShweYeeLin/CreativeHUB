import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: 'freelancer' | 'client';
          location: string | null;
          rating: number;
          total_reviews: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };
      freelancer_profiles: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          description: string | null;
          hourly_rate: number | null;
          skills: string[];
          styles: string[];
          experience_years: number | null;
          portfolio_count: number;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['freelancer_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['freelancer_profiles']['Row']>;
      };
      portfolios: {
        Row: {
          id: string;
          freelancer_id: string;
          title: string;
          description: string | null;
          image_urls: string[];
          project_url: string | null;
          tools_used: string[];
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['portfolios']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['portfolios']['Row']>;
      };
      bookings: {
        Row: {
          id: string;
          client_id: string;
          freelancer_id: string;
          project_name: string;
          description: string | null;
          budget: number;
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
          start_date: string | null;
          end_date: string | null;
          deliverables: string | null;
          payment_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bookings']['Row']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          recipient_id: string;
          content: string;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      conversations: {
        Row: {
          id: string;
          participant_1_id: string;
          participant_2_id: string;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Row']>;
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          freelancer_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['favorites']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      requests: {
        Row: {
          id: string;
          client_id: string;
          freelancer_id: string;
          project_name: string;
          description: string | null;
          budget: number | null;
          status: 'pending' | 'accepted' | 'rejected' | 'completed';
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['requests']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string | null;
          related_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
      };
    };
  };
};
