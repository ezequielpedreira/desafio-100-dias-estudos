-- Cover foreign keys used by joins and cascading deletes.
create index if not exists daily_progress_challenge_id_idx
  on public.daily_progress(challenge_id);

create index if not exists session_pauses_user_id_idx
  on public.session_pauses(user_id);

create index if not exists study_sessions_category_id_idx
  on public.study_sessions(category_id);

create index if not exists study_sessions_challenge_id_idx
  on public.study_sessions(challenge_id);

create index if not exists user_achievements_achievement_id_idx
  on public.user_achievements(achievement_id);

create index if not exists xp_transactions_challenge_id_idx
  on public.xp_transactions(challenge_id);

create index if not exists xp_transactions_session_id_idx
  on public.xp_transactions(session_id);
