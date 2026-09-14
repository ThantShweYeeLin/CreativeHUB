-- Reviews are bidirectional (a client reviews a freelancer, or a freelancer
-- reviews a client — see supabase/schema.sql's generic reviewer_id/
-- reviewee_id shape and both BookingTrackingClientPage/
-- BookingTrackingFreelancerPage's BookingReviewPrompt usage), but visibility
-- must differ by direction:
--   - A review ABOUT a freelancer is a public trust signal — visible to
--     anyone, same as the freelancer's profile itself.
--   - A review ABOUT a client is only ever useful to another freelancer
--     deciding whether to work with that client, and must NOT be visible to
--     the client themselves or to any other client — a client can write
--     one, but never read any (their own included).
--
-- The previous policy ("Users can view own related reviews", auth.uid() =
-- reviewer_id OR auth.uid() = reviewee_id) let a client reviewee read
-- reviews about themselves, and also never granted a browsing client (who
-- is neither reviewer nor reviewee) visibility into a freelancer's public
-- reviews at all — both wrong for what the product needs. Replaced
-- entirely.

drop policy if exists "Users can view own related reviews" on public.reviews;

create policy "Reviews about freelancers are visible to any signed-in user" on public.reviews
  for select using (
    exists (select 1 from public.users u where u.id = reviews.reviewee_id and u.role = 'freelancer')
  );

create policy "Freelancers can view reviews about clients" on public.reviews
  for select using (
    exists (select 1 from public.users u where u.id = reviews.reviewee_id and u.role = 'client')
    and exists (select 1 from public.users viewer where viewer.id = auth.uid() and viewer.role = 'freelancer')
  );

create policy "Admins can view all reviews" on public.reviews
  for select using (public.is_admin(auth.uid()));
