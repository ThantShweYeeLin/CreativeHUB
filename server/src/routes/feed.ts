import { Router } from 'express';
import { createSupabaseForRequest, getBearerToken } from '../lib/supabase.js';

const router = Router();

router.use((req, res, next) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ message: 'Missing Supabase bearer token.' });
  res.locals.supabase = createSupabaseForRequest(token);
  return next();
});

router.get('/for-you', async (req, res) => {
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 8;
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { data, error } = await res.locals.supabase.rpc('get_for_you_feed', {
    viewer_id: authData.user.id,
    cursor_score: req.query.cursorScore ? Number(req.query.cursorScore) : null,
    cursor_created_at: req.query.cursorCreatedAt ?? null,
    cursor_post_id: req.query.cursorPostId ?? null,
    page_size: pageSize,
  });

  if (error) return res.status(400).json({ message: error.message });

  const posts = data ?? [];
  const last = posts[posts.length - 1];
  return res.json({
    posts,
    nextCursor:
      posts.length === pageSize && last
        ? { score: Number(last.engagement_score), createdAt: last.created_at, postId: last.id }
        : null,
  });
});

router.get('/suggested-creators', async (_req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { data, error } = await res.locals.supabase.rpc('get_suggested_creators', {
    viewer_id: authData.user.id,
    page_size: 5,
  });

  if (error) return res.status(400).json({ message: error.message });
  return res.json({ creators: data ?? [] });
});

router.get('/collections', async (_req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { data, error } = await res.locals.supabase
    .from('save_collections')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(400).json({ message: error.message });
  return res.json({ collections: data ?? [] });
});

router.post('/collections', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(422).json({ message: 'Collection name is required.' });

  const { data, error } = await res.locals.supabase
    .from('save_collections')
    .insert({ user_id: authData.user.id, name: name.trim() })
    .select('*')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  return res.status(201).json({ collection: data });
});

router.get('/saved-posts', async (req, res) => {
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 8;
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { data, error } = await res.locals.supabase.rpc('get_saved_posts', {
    viewer_id: authData.user.id,
    target_collection_id: req.query.collectionId ?? null,
    cursor_created_at: req.query.cursorCreatedAt ?? null,
    cursor_post_id: req.query.cursorPostId ?? null,
    page_size: pageSize,
  });

  if (error) return res.status(400).json({ message: error.message });

  const posts = data ?? [];
  const last = posts[posts.length - 1];
  return res.json({
    posts,
    nextCursor:
      posts.length === pageSize && last
        ? { createdAt: last.created_at, postId: last.id }
        : null,
  });
});

router.get('/posts/:postId/comments', async (req, res) => {
  const { data, error } = await res.locals.supabase.rpc('get_post_comments', {
    target_post_id: req.params.postId,
  });

  if (error) return res.status(400).json({ message: error.message });
  return res.json({ comments: data ?? [] });
});

router.post('/posts/:postId/comments', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { body, parentId = null } = req.body as { body?: string; parentId?: string | null };
  if (!body?.trim()) return res.status(422).json({ message: 'Comment body is required.' });

  const { data, error } = await res.locals.supabase
    .from('post_comments')
    .insert({ post_id: req.params.postId, user_id: authData.user.id, parent_id: parentId, body: body.trim() })
    .select('id')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  return res.status(201).json({ comment: data });
});

router.delete('/comments/:commentId', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { error } = await res.locals.supabase.from('post_comments').delete().eq('id', req.params.commentId).eq('user_id', authData.user.id);
  if (error) return res.status(400).json({ message: error.message });
  return res.status(204).send();
});

router.post('/posts/:postId/likes/toggle', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { liked } = req.body as { liked?: boolean };
  if (liked) {
    const { error } = await res.locals.supabase.from('post_likes').delete().eq('post_id', req.params.postId).eq('user_id', authData.user.id);
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ liked: false });
  }

  const { error } = await res.locals.supabase.from('post_likes').insert({ post_id: req.params.postId, user_id: authData.user.id });
  if (error && error.code !== '23505') return res.status(400).json({ message: error.message });
  return res.json({ liked: true });
});

router.post('/posts/:postId/saves/toggle', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { saved, collectionId = null } = req.body as { saved?: boolean; collectionId?: string | null };
  if (saved) {
    let query = res.locals.supabase.from('saved_posts').delete().eq('post_id', req.params.postId).eq('user_id', authData.user.id);
    query = collectionId ? query.eq('collection_id', collectionId) : query.is('collection_id', null);
    const { error } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ saved: false });
  }

  const { error } = await res.locals.supabase
    .from('saved_posts')
    .insert({ post_id: req.params.postId, user_id: authData.user.id, collection_id: collectionId });
  if (error && error.code !== '23505') return res.status(400).json({ message: error.message });
  return res.json({ saved: true });
});

router.post('/posts/:postId/shares', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { target, recipientId = null } = req.body as { target?: string; recipientId?: string | null };
  if (!target) return res.status(422).json({ message: 'Share target is required.' });

  const { data, error } = await res.locals.supabase
    .from('post_shares')
    .insert({ post_id: req.params.postId, user_id: authData.user.id, target, recipient_id: recipientId })
    .select('id')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  return res.status(201).json({ share: data });
});

router.post('/creators/:creatorId/follow/toggle', async (req, res) => {
  const { data: authData, error: authError } = await res.locals.supabase.auth.getUser();
  if (authError || !authData.user) return res.status(401).json({ message: 'Invalid Supabase session.' });

  const { following } = req.body as { following?: boolean };
  if (following) {
    const { error } = await res.locals.supabase.from('followers').delete().eq('follower_id', authData.user.id).eq('following_id', req.params.creatorId);
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ following: false });
  }

  const { error } = await res.locals.supabase.from('followers').insert({ follower_id: authData.user.id, following_id: req.params.creatorId });
  if (error && error.code !== '23505') return res.status(400).json({ message: error.message });
  return res.json({ following: true });
});

export default router;
