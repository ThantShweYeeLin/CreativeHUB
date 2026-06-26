import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { FeedCommentRow, FeedPostRow, SaveCollectionRow, ShareTarget, SuggestedCreatorRow } from './database.types';

export interface FeedCursor {
  score: number;
  createdAt: string;
  postId: string;
}

export interface FeedPage {
  posts: FeedPostRow[];
  nextCursor: FeedCursor | null;
}

export interface SavedFeedCursor {
  createdAt: string;
  postId: string;
}

const PAGE_SIZE = 8;

function toCursor(post: FeedPostRow | undefined): FeedCursor | null {
  if (!post) return null;
  return {
    score: Number(post.engagement_score),
    createdAt: post.created_at,
    postId: post.id,
  };
}

export class FeedService {
  static async getForYouFeed(userId: string, cursor: FeedCursor | null = null, pageSize = PAGE_SIZE): Promise<FeedPage> {
    const { data, error } = await supabase.rpc('get_for_you_feed', {
      viewer_id: userId,
      cursor_score: cursor?.score ?? null,
      cursor_created_at: cursor?.createdAt ?? null,
      cursor_post_id: cursor?.postId ?? null,
      page_size: pageSize,
    });

    if (error) throw error;

    const posts = (data ?? []) as FeedPostRow[];
    return {
      posts,
      nextCursor: posts.length === pageSize ? toCursor(posts[posts.length - 1]) : null,
    };
  }

  static async getComments(postId: string): Promise<FeedCommentRow[]> {
    const { data, error } = await supabase.rpc('get_post_comments', { target_post_id: postId });
    if (error) throw error;
    return (data ?? []) as FeedCommentRow[];
  }

  static async getSavedPosts(
    userId: string,
    collectionId: string | null = null,
    cursor: SavedFeedCursor | null = null,
    pageSize = PAGE_SIZE,
  ): Promise<{ posts: FeedPostRow[]; nextCursor: SavedFeedCursor | null }> {
    const { data, error } = await supabase.rpc('get_saved_posts', {
      viewer_id: userId,
      target_collection_id: collectionId,
      cursor_created_at: cursor?.createdAt ?? null,
      cursor_post_id: cursor?.postId ?? null,
      page_size: pageSize,
    });

    if (error) throw error;

    const posts = (data ?? []) as FeedPostRow[];
    const last = posts[posts.length - 1];
    return {
      posts,
      nextCursor: posts.length === pageSize && last ? { createdAt: last.created_at, postId: last.id } : null,
    };
  }

  static async addComment(userId: string, postId: string, body: string, parentId: string | null = null) {
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        user_id: userId,
        post_id: postId,
        parent_id: parentId,
        body: body.trim(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteComment(userId: string, commentId: string) {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', userId);
    if (error) throw error;
  }

  static async toggleLike(userId: string, postId: string, liked: boolean) {
    if (liked) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
      return false;
    }

    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') throw error;
    return true;
  }

  static async toggleSave(userId: string, postId: string, saved: boolean, collectionId: string | null = null) {
    if (saved) {
      let query = supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', userId);
      query = collectionId ? query.eq('collection_id', collectionId) : query.is('collection_id', null);
      const { error } = await query;
      if (error) throw error;
      return false;
    }

    const { error } = await supabase.from('saved_posts').insert({
      post_id: postId,
      user_id: userId,
      collection_id: collectionId,
    });

    if (error && error.code !== '23505') throw error;
    return true;
  }

  static async getCollections(userId: string): Promise<SaveCollectionRow[]> {
    const { data, error } = await supabase
      .from('save_collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as SaveCollectionRow[];
  }

  static async createCollection(userId: string, name: string) {
    const { data, error } = await supabase
      .from('save_collections')
      .insert({ user_id: userId, name: name.trim() })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async sharePost(userId: string, postId: string, target: ShareTarget, recipientId: string | null = null) {
    const { data, error } = await supabase
      .from('post_shares')
      .insert({ post_id: postId, user_id: userId, target, recipient_id: recipientId })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  static async toggleFollow(userId: string, creatorId: string, following: boolean) {
    if (following) {
      const { error } = await supabase.from('followers').delete().eq('follower_id', userId).eq('following_id', creatorId);
      if (error) throw error;
      return false;
    }

    const { error } = await supabase.from('followers').insert({ follower_id: userId, following_id: creatorId });
    if (error && error.code !== '23505') throw error;
    return true;
  }

  static async getSuggestedCreators(userId: string, pageSize = 5): Promise<SuggestedCreatorRow[]> {
    const { data, error } = await supabase.rpc('get_suggested_creators', {
      viewer_id: userId,
      page_size: pageSize,
    });

    if (error) throw error;
    return (data ?? []) as SuggestedCreatorRow[];
  }

  static subscribeToFeed(onChange: () => void): RealtimeChannel {
    return supabase
      .channel('for-you-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_shares' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_posts' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'followers' }, onChange)
      .subscribe();
  }

  static subscribeToComments(postId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`post-comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, onChange)
      .subscribe();
  }

  static subscribeToNotifications(userId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
  }
}
