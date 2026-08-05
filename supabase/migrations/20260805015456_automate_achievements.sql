-- Award achievements from persisted server events. The unique constraint on
-- (user_id, achievement_id) and the XP idempotency key make retries harmless.

create function private.grant_achievement(
  p_user_id uuid,
  p_achievement_id uuid,
  p_session_id uuid,
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted uuid;
  v_reward integer;
  v_name text;
begin
  insert into public.user_achievements(user_id, achievement_id)
  values (p_user_id, p_achievement_id)
  on conflict (user_id, achievement_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then return; end if;

  select xp_reward, name
    into v_reward, v_name
    from public.achievements
   where id = p_achievement_id;

  if coalesce(v_reward, 0) > 0 then
    insert into public.xp_transactions(
      user_id, session_id, challenge_id, transaction_type,
      amount, description, idempotency_key
    )
    values (
      p_user_id, p_session_id, p_challenge_id, 'achievement',
      v_reward, 'Conquista: ' || v_name,
      'achievement:' || p_user_id || ':' || p_achievement_id
    )
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

create function private.evaluate_checkin_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkins integer;
  v_streak integer;
  v_local_hour integer;
  v_timezone text;
  v_achievement record;
begin
  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = new.user_id;

  select count(*)::integer
    into v_checkins
    from public.daily_checkins
   where user_id = new.user_id;

  with sequence as (
    select
      checkin_date,
      row_number() over (order by checkin_date desc) as row_number,
      max(checkin_date) over () as last_date
    from public.daily_checkins
    where user_id = new.user_id
  )
  select count(*)::integer
    into v_streak
    from sequence
   where checkin_date = last_date - (row_number::integer - 1);

  v_local_hour := extract(hour from new.checked_in_at at time zone v_timezone)::integer;

  for v_achievement in
    select id
      from public.achievements
     where is_active
       and (
         (condition_type in ('checkins', 'completed_days') and condition_value <= v_checkins)
         or (condition_type = 'streak' and condition_value <= v_streak)
         or (condition_type = 'start_hour_before' and v_local_hour < condition_value)
       )
  loop
    perform private.grant_achievement(new.user_id, v_achievement.id, new.session_id, new.challenge_id);
  end loop;

  return new;
end;
$$;

create function private.evaluate_session_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed_sessions integer;
  v_minutes integer;
  v_finish_hour integer;
  v_timezone text;
  v_achievement record;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;

  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = new.user_id;

  select count(*)::integer
    into v_completed_sessions
    from public.study_sessions
   where user_id = new.user_id
     and status = 'completed';

  v_minutes := floor(new.effective_duration_seconds / 60);
  v_finish_hour := extract(hour from new.finished_at at time zone v_timezone)::integer;

  for v_achievement in
    select id
      from public.achievements
     where is_active
       and (
         (condition_type = 'checkouts' and condition_value <= v_completed_sessions)
         or (condition_type = 'session_minutes' and condition_value <= v_minutes)
         or (condition_type = 'finish_hour_after' and v_finish_hour >= condition_value)
       )
  loop
    perform private.grant_achievement(new.user_id, v_achievement.id, new.id, new.challenge_id);
  end loop;

  return new;
end;
$$;

create trigger daily_checkins_award_achievements
after insert on public.daily_checkins
for each row execute function private.evaluate_checkin_achievements();

create trigger study_sessions_award_achievements
after update of status on public.study_sessions
for each row execute function private.evaluate_session_achievements();

revoke all on function private.grant_achievement(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.evaluate_checkin_achievements()
  from public, anon, authenticated;
revoke all on function private.evaluate_session_achievements()
  from public, anon, authenticated;
