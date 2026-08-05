-- Keep challenge dates and study dates in the user's configured timezone.
-- Supabase/Postgres remains in UTC; only date boundaries are localized.

create or replace function private.complete_onboarding_impl(
  p_main_study_goal text,
  p_priority_subject text,
  p_daily_goal_minutes integer,
  p_start_date date,
  p_ranking_visibility text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := private.assert_user();
  v_challenge uuid;
  v_timezone text;
  v_today date;
begin
  if p_daily_goal_minutes not between 1 and 600
    or p_start_date is null
    or p_ranking_visibility not in ('full_name','first_name','nickname','anonymous','hidden')
  then
    raise exception 'Dados de onboarding inválidos';
  end if;

  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = v_user;
  v_today := (clock_timestamp() at time zone v_timezone)::date;

  update public.profiles
     set main_study_goal = left(trim(p_main_study_goal), 300),
         priority_subject = left(trim(p_priority_subject), 80),
         daily_goal_minutes = p_daily_goal_minutes,
         display_name = nullif(left(trim(p_display_name), 50), ''),
         ranking_visibility = p_ranking_visibility,
         onboarding_completed = true
   where id = v_user;

  insert into public.challenges(user_id, start_date, end_date, status)
  values (
    v_user,
    p_start_date,
    p_start_date + 99,
    case when p_start_date > v_today then 'scheduled' else 'active' end
  )
  on conflict(user_id) where status in ('scheduled','active')
  do update
        set start_date = excluded.start_date,
            end_date = excluded.end_date,
            status = excluded.status,
            updated_at = now()
  returning id into v_challenge;

  return v_challenge;
end;
$$;

create or replace function private.create_checkin_impl(
  p_title text,
  p_planned_content text,
  p_planned_objective text,
  p_category_name text,
  p_planned_minutes integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := private.assert_user();
  v_challenge uuid;
  v_category uuid;
  v_session uuid;
  v_timezone text;
  v_today date;
begin
  if p_planned_minutes not between 1 and 600
    or char_length(trim(p_title)) not between 1 and 120
  then
    raise exception 'Dados de check-in inválidos';
  end if;

  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = v_user;
  v_today := (clock_timestamp() at time zone v_timezone)::date;

  select id
    into v_challenge
    from public.challenges
   where user_id = v_user
     and status in ('active','scheduled')
     and start_date <= v_today
     and end_date >= v_today
   order by created_at desc
   limit 1;

  if v_challenge is null then
    raise exception 'Nenhum desafio ativo';
  end if;
  if exists (
    select 1
      from public.study_sessions
     where user_id = v_user
       and status in ('active','paused')
  ) then
    raise exception 'Já existe uma sessão em andamento';
  end if;

  select id
    into v_category
    from public.study_categories
   where lower(name) = lower(trim(p_category_name))
     and (is_system or user_id = v_user)
   order by is_system desc
   limit 1;

  insert into public.study_sessions(
    user_id, challenge_id, category_id, title, planned_content,
    planned_objective, planned_minutes, notes, started_at
  )
  values (
    v_user, v_challenge, v_category, left(trim(p_title), 120),
    left(trim(p_planned_content), 500), left(trim(p_planned_objective), 500),
    p_planned_minutes, left(p_notes, 1000), clock_timestamp()
  )
  returning id into v_session;

  insert into public.xp_transactions(
    user_id, session_id, challenge_id, transaction_type,
    amount, description, idempotency_key
  )
  values (
    v_user, v_session, v_challenge, 'checkin',
    10, 'Check-in realizado', 'session:' || v_session || ':checkin'
  )
  on conflict(idempotency_key) do nothing;

  return v_session;
end;
$$;

-- Repair challenges created after 21:00 in negative UTC offsets. The original
-- client used the UTC calendar date, so a session could start one local day
-- before its challenge and fail check-out with challenge_day = 0.
with first_session as (
  select
    c.id as challenge_id,
    min((s.started_at at time zone p.timezone)::date) as first_study_date
  from public.challenges c
  join public.profiles p on p.id = c.user_id
  join public.study_sessions s on s.challenge_id = c.id
  where c.status in ('active','scheduled')
  group by c.id
)
update public.challenges c
   set start_date = first_session.first_study_date,
       end_date = first_session.first_study_date + (c.total_days - 1),
       status = 'active',
       updated_at = now()
  from first_session, public.profiles p
 where c.id = first_session.challenge_id
   and p.id = c.user_id
   and first_session.first_study_date = c.start_date - 1
   and (c.created_at at time zone p.timezone)::date = first_session.first_study_date
   and not exists (
     select 1 from public.daily_progress d where d.challenge_id = c.id
   );
