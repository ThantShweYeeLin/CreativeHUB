-- Reviews can now actually reach the `reviews` table (see
-- reviews_insert_policy_fix.sql and the new BookingReviewPrompt UI), but
-- nothing ever recalculates the reviewee's aggregate users.rating /
-- users.total_reviews from them - every profile card, search result, and
-- booking header reads those two columns directly, so a freelancer (or
-- client) could accumulate real reviews and still show "★ 0 (0 reviews)"
-- everywhere. This adds the trigger that keeps those two columns in sync
-- with the reviews table, so the fix already shipped in the app actually
-- becomes visible. Safe to re-run.

create or replace function public.recalculate_reviewee_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewee_id uuid := coalesce(new.reviewee_id, old.reviewee_id);
  v_avg numeric;
  v_count int;
begin
  select avg(rating), count(*) into v_avg, v_count
  from public.reviews
  where reviewee_id = v_reviewee_id;

  update public.users
    set rating = coalesce(round(v_avg, 2), 0),
        total_reviews = coalesce(v_count, 0)
    where id = v_reviewee_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_recalculate_rating on public.reviews;
create trigger reviews_recalculate_rating
  after insert or update of rating or delete on public.reviews
  for each row execute function public.recalculate_reviewee_rating();

-- One-time backfill for any reviews already sitting in the table from
-- before this trigger existed.
update public.users u set
  rating = coalesce((select round(avg(r.rating), 2) from public.reviews r where r.reviewee_id = u.id), 0),
  total_reviews = coalesce((select count(*) from public.reviews r where r.reviewee_id = u.id), 0)
where exists (select 1 from public.reviews r where r.reviewee_id = u.id);
