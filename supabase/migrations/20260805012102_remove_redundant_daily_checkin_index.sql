-- session_id already has a unique constraint, whose index covers lookups.
drop index if exists public.daily_checkins_session_idx;
