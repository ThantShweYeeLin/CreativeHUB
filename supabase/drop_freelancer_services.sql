-- The per-service pricing packages feature (freelancer_services, created in
-- dashboard_features.sql) is being removed: the app never shipped a UI for
-- freelancers to manage these, only 14 profiles ever had one row (added
-- directly via SQL/test data), and FreelancerProfile.tsx's "Services"
-- section plus Event Assistant's price-matching now rely solely on
-- freelancer_profiles.hourly_rate. Run this once against your Supabase
-- project's SQL editor to drop the table and all its data.

drop table if exists public.freelancer_services;
