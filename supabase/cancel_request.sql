-- Lets a client cancel their own still-pending booking request. Run this
-- statement by itself first if your SQL editor wraps the whole script in
-- one transaction — "alter type ... add value" can't run in the same
-- transaction as statements that use the new value.

alter type request_status add value if not exists 'cancelled';
