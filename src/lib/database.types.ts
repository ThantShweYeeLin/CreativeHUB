export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CreativeProfession =
  | 'Fashion Designer'
  | 'Photographer'
  | 'Videographer'
  | 'Model'
  | 'Makeup Artist'
  | 'Graphic Designer'
  | 'Illustrator'
  | 'Stylist'
  | 'Architect'
  | 'Creative Director';

export type PostMediaType = 'image' | 'video';
export type ShareTarget = 'creativehub' | 'copy_link' | 'whatsapp' | 'telegram' | 'facebook' | 'x';

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
          bio: string | null;
          role: 'freelancer' | 'client';
          location: string | null;
          rating: number;
          total_reviews: number;
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
      profiles: {
        Row: Row<{
          id: string;
          full_name: string;
          username: string;
          avatar_url: string | null;
          bio: string | null;
          profession: CreativeProfession;
          is_pro: boolean;
          is_verified: boolean;
          profile_views: number;
          follower_count: number;
          following_count: number;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['profiles']['Row']>;
        Update: Update<Database['public']['Tables']['profiles']['Row']>;
      };
      posts: {
        Row: Row<{
          id: string;
          author_id: string;
          caption: string;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          saves_count: number;
          profile_views_snapshot: number;
          engagement_score: number;
          is_trending: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['posts']['Row']>;
        Update: Update<Database['public']['Tables']['posts']['Row']>;
      };
      post_media: {
        Row: Row<{
          id: string;
          post_id: string;
          media_type: PostMediaType;
          url: string;
          thumbnail_url: string | null;
          alt_text: string | null;
          position: number;
          created_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['post_media']['Row']>;
        Update: Update<Database['public']['Tables']['post_media']['Row']>;
      };
      post_likes: {
        Row: Row<{ id: string; post_id: string; user_id: string; created_at: string }>;
        Insert: Insert<Database['public']['Tables']['post_likes']['Row']>;
        Update: Update<Database['public']['Tables']['post_likes']['Row']>;
      };
      post_comments: {
        Row: Row<{
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          mentions: string[];
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['post_comments']['Row']>;
        Update: Update<Database['public']['Tables']['post_comments']['Row']>;
      };
      post_shares: {
        Row: Row<{
          id: string;
          post_id: string;
          user_id: string;
          target: ShareTarget;
          recipient_id: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database['public']['Tables']['post_shares']['Row']>;
        Update: Update<Database['public']['Tables']['post_shares']['Row']>;
      };
      save_collections: {
        Row: Row<{ id: string; user_id: string; name: string; created_at: string; updated_at: string }>;
        Insert: Insert<Database['public']['Tables']['save_collections']['Row']>;
        Update: Update<Database['public']['Tables']['save_collections']['Row']>;
      };
      saved_posts: {
        Row: Row<{ id: string; post_id: string; user_id: string; collection_id: string | null; created_at: string }>;
        Insert: Insert<Database['public']['Tables']['saved_posts']['Row']>;
        Update: Update<Database['public']['Tables']['saved_posts']['Row']>;
      };
      followers: {
        Row: Row<{ id: string; follower_id: string; following_id: string; created_at: string }>;
        Insert: Insert<Database['public']['Tables']['followers']['Row']>;
        Update: Update<Database['public']['Tables']['followers']['Row']>;
      };
    };
    Views: {
      for_you_posts: { Row: Record<string, any> };
    };
    Functions: {
      get_for_you_feed: {
        Args: {
          viewer_id?: string | null;
          cursor_score?: number | null;
          cursor_created_at?: string | null;
          cursor_post_id?: string | null;
          page_size?: number;
        };
        Returns: FeedPostRow[];
      };
      get_post_comments: {
        Args: { target_post_id: string };
        Returns: FeedCommentRow[];
      };
      get_suggested_creators: {
        Args: { viewer_id?: string | null; page_size?: number };
        Returns: SuggestedCreatorRow[];
      };
      get_saved_posts: {
        Args: {
          viewer_id?: string | null;
          target_collection_id?: string | null;
          cursor_created_at?: string | null;
          cursor_post_id?: string | null;
          page_size?: number;
        };
        Returns: FeedPostRow[];
      };
    };
    Enums: {
      creative_profession: CreativeProfession;
      post_media_type: PostMediaType;
      share_target: ShareTarget;
      notification_type: 'like' | 'comment' | 'follow' | 'share' | 'mention';
    };
  };
}

export interface FeedAuthor {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  profession: CreativeProfession;
  is_pro: boolean;
  is_verified: boolean;
  follower_count: number;
}

export interface FeedMedia {
  id: string;
  media_type: PostMediaType;
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  position: number;
}

export interface FeedViewerState {
  liked: boolean;
  saved: boolean;
  following_author: boolean;
}

export interface FeedPostRow {
  id: string;
  author_id: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  profile_views_snapshot: number;
  engagement_score: number;
  is_trending: boolean;
  created_at: string;
  author: FeedAuthor;
  media: FeedMedia[];
  viewer: FeedViewerState;
}

export interface FeedCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
  author: Omit<FeedAuthor, 'is_verified' | 'follower_count'>;
}

export type SuggestedCreatorRow = FeedAuthor;

export interface SaveCollectionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
