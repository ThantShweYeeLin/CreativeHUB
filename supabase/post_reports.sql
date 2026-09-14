-- Lets a client_posts row be the subject of a report, reusing the existing
-- user_reports table/RLS/admin-resolution flow (admin_system_2_rest.sql)
-- instead of building a second, parallel reports system. When a report is
-- about a post, reported_user_id is set to that post's author, so the
-- existing admin decision flow (warning/suspend/ban the reported user) and
-- RLS policies work completely unchanged — reported_post_id is only an
-- extra pointer so the admin UI can also show/link the specific post.

alter table public.user_reports
  add column if not exists reported_post_id uuid references public.client_posts(id) on delete cascade;
