-- One canonical, server-dated check-in per user and local calendar day.
-- Existing study sessions are preserved; when legacy duplicates exist, the
-- active session (or otherwise the earliest session) becomes the canonical
-- check-in for that day.

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  session_id uuid unique references public.study_sessions(id) on delete cascade,
  checkin_date date not null,
  checked_in_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint daily_checkins_user_date_key unique (user_id, checkin_date)
);

create index daily_checkins_challenge_date_idx
  on public.daily_checkins(challenge_id, checkin_date desc);

with ranked_sessions as (
  select
    s.user_id,
    s.challenge_id,
    s.id as session_id,
    (s.started_at at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date as checkin_date,
    s.started_at as checked_in_at,
    row_number() over (
      partition by s.user_id,
        (s.started_at at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
      order by
        case when s.status in ('active', 'paused') then 0 else 1 end,
        s.started_at
    ) as row_number
  from public.study_sessions s
  join public.profiles p on p.id = s.user_id
  where s.status <> 'cancelled'
)
insert into public.daily_checkins(
  user_id, challenge_id, session_id, checkin_date, checked_in_at
)
select user_id, challenge_id, session_id, checkin_date, checked_in_at
from ranked_sessions
where row_number = 1
on conflict (user_id, checkin_date) do nothing;

alter table public.daily_checkins enable row level security;
create policy daily_checkins_own
  on public.daily_checkins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.daily_checkins from public, anon, authenticated;
grant select on public.daily_checkins to authenticated;

create or replace function private.validate_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names() tz where tz.name = new.timezone
  ) then
    raise exception 'Fuso horário inválido' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
before insert or update of timezone on public.profiles
for each row execute function private.validate_profile_timezone();

drop function public.create_checkin(text, text, text, text, integer, text);
drop function private.create_checkin_impl(text, text, text, text, integer, text);

create function private.create_checkin_impl(
  p_title text,
  p_planned_content text,
  p_planned_objective text,
  p_category_name text,
  p_planned_minutes integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.assert_user();
  v_challenge uuid;
  v_category uuid;
  v_session uuid;
  v_checkin uuid;
  v_existing public.daily_checkins%rowtype;
  v_timezone text;
  v_today date;
  v_now timestamptz := clock_timestamp();
  v_next_checkin_at timestamptz;
begin
  if p_planned_minutes not between 1 and 600
    or char_length(trim(coalesce(p_title, ''))) not between 1 and 120
    or char_length(trim(coalesce(p_planned_content, ''))) not between 1 and 500
    or char_length(trim(coalesce(p_planned_objective, ''))) not between 1 and 500
    or char_length(trim(coalesce(p_category_name, ''))) not between 1 and 80
    or char_length(coalesce(p_notes, '')) > 1000
  then
    raise exception 'Dados de check-in inválidos' using errcode = '22023';
  end if;

  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = v_user;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_today := (v_now at time zone v_timezone)::date;
  v_next_checkin_at := ((v_today + 1)::timestamp at time zone v_timezone);

  select *
    into v_existing
    from public.daily_checkins
   where user_id = v_user
     and checkin_date = v_today;

  if found then
    return jsonb_build_object(
      'created', false,
      'already_checked_in', true,
      'checkin_id', v_existing.id,
      'session_id', v_existing.session_id,
      'checkin_date', v_existing.checkin_date,
      'checked_in_at', v_existing.checked_in_at,
      'timezone', v_timezone,
      'next_checkin_at', v_next_checkin_at,
      'message', 'Check-in de hoje já foi concluído.'
    );
  end if;

  if exists (
    select 1
      from public.study_sessions
     where user_id = v_user
       and status in ('active', 'paused')
  ) then
    raise exception 'Já existe uma sessão em andamento' using errcode = '55000';
  end if;

  select id
    into v_challenge
    from public.challenges
   where user_id = v_user
     and status in ('active', 'scheduled')
     and start_date <= v_today
     and end_date >= v_today
   order by created_at desc
   limit 1;

  if v_challenge is null then
    raise exception 'Nenhum desafio ativo' using errcode = '55000';
  end if;

  select id
    into v_category
    from public.study_categories
   where lower(name) = lower(trim(p_category_name))
     and (is_system or user_id = v_user)
   order by is_system desc
   limit 1;

  if v_category is null then
    raise exception 'Categoria de estudo inválida' using errcode = '22023';
  end if;

  insert into public.daily_checkins(
    user_id, challenge_id, checkin_date, checked_in_at
  )
  values (v_user, v_challenge, v_today, v_now)
  on conflict (user_id, checkin_date) do nothing
  returning id into v_checkin;

  if v_checkin is null then
    select *
      into v_existing
      from public.daily_checkins
     where user_id = v_user
       and checkin_date = v_today;

    return jsonb_build_object(
      'created', false,
      'already_checked_in', true,
      'checkin_id', v_existing.id,
      'session_id', v_existing.session_id,
      'checkin_date', v_existing.checkin_date,
      'checked_in_at', v_existing.checked_in_at,
      'timezone', v_timezone,
      'next_checkin_at', v_next_checkin_at,
      'message', 'Check-in de hoje já foi concluído.'
    );
  end if;

  insert into public.study_sessions(
    user_id, challenge_id, category_id, title, planned_content,
    planned_objective, planned_minutes, notes, started_at
  )
  values (
    v_user, v_challenge, v_category, trim(p_title),
    trim(p_planned_content), trim(p_planned_objective),
    p_planned_minutes, nullif(trim(p_notes), ''), v_now
  )
  returning id into v_session;

  update public.daily_checkins
     set session_id = v_session
   where id = v_checkin;

  insert into public.xp_transactions(
    user_id, session_id, challenge_id, transaction_type,
    amount, description, idempotency_key
  )
  values (
    v_user, v_session, v_challenge, 'checkin',
    10, 'Check-in realizado', 'daily-checkin:' || v_checkin
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'created', true,
    'already_checked_in', false,
    'checkin_id', v_checkin,
    'session_id', v_session,
    'checkin_date', v_today,
    'checked_in_at', v_now,
    'timezone', v_timezone,
    'next_checkin_at', v_next_checkin_at,
    'message', 'Check-in realizado com sucesso.'
  );
end;
$$;

create function public.create_checkin(
  p_title text,
  p_planned_content text,
  p_planned_objective text,
  p_category_name text,
  p_planned_minutes integer,
  p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_checkin_impl($1, $2, $3, $4, $5, $6)
$$;

create function private.get_daily_checkin_status_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.assert_user();
  v_timezone text;
  v_today date;
  v_now timestamptz := clock_timestamp();
  v_checkin public.daily_checkins%rowtype;
begin
  select coalesce(timezone, 'America/Sao_Paulo')
    into v_timezone
    from public.profiles
   where id = v_user;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_today := (v_now at time zone v_timezone)::date;

  select *
    into v_checkin
    from public.daily_checkins
   where user_id = v_user
     and checkin_date = v_today;

  return jsonb_build_object(
    'checked_in', found,
    'checkin_id', v_checkin.id,
    'session_id', v_checkin.session_id,
    'checkin_date', v_today,
    'checked_in_at', v_checkin.checked_in_at,
    'timezone', v_timezone,
    'server_time', v_now,
    'next_checkin_at', ((v_today + 1)::timestamp at time zone v_timezone)
  );
end;
$$;

create function public.get_daily_checkin_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_daily_checkin_status_impl()
$$;

-- Streaks are based on canonical daily check-ins, not on device time or on
-- whether a user happened to submit a second session on the same day.
create or replace function private.get_ranking_impl(p_limit integer default 50)
returns table(
  rank_position bigint,
  user_id uuid,
  display_name text,
  total_xp bigint,
  total_seconds bigint,
  current_streak integer,
  completed_days bigint,
  level integer
)
language sql
security definer
set search_path = ''
as $$
with allowed as (
  select private.assert_user()
),
checkin_sequence as (
  select
    c.user_id,
    c.checkin_date,
    row_number() over (partition by c.user_id order by c.checkin_date desc) as row_number,
    max(c.checkin_date) over (partition by c.user_id) as last_date
  from public.daily_checkins c
),
streaks as (
  select
    sequence.user_id,
    count(*) filter (
      where sequence.last_date >=
        ((clock_timestamp() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date - 1)
      and sequence.checkin_date = sequence.last_date - (sequence.row_number::integer - 1)
    )::integer as current_streak
  from checkin_sequence sequence
  join public.profiles p on p.id = sequence.user_id
  group by sequence.user_id
),
stats as (
  select
    p.id,
    p.full_name,
    p.display_name,
    p.ranking_visibility,
    coalesce(x.total_xp, 0)::bigint as total_xp,
    coalesce(d.total_seconds, 0)::bigint as total_seconds,
    coalesce(c.completed_days, 0)::bigint as completed_days,
    coalesce(s.current_streak, 0) as current_streak
  from public.profiles p
  cross join allowed
  left join lateral (
    select sum(amount)::bigint as total_xp
    from public.xp_transactions
    where user_id = p.id
  ) x on true
  left join lateral (
    select sum(total_duration_seconds)::bigint as total_seconds
    from public.daily_progress
    where user_id = p.id
  ) d on true
  left join lateral (
    select count(*)::bigint as completed_days
    from public.daily_checkins
    where user_id = p.id
  ) c on true
  left join streaks s on s.user_id = p.id
  where p.ranking_visibility <> 'hidden'
),
ranked as (
  select
    row_number() over (
      order by total_xp desc, completed_days desc, total_seconds desc, id
    ) as rank_position,
    *
  from stats
)
select
  rank_position,
  id,
  case ranking_visibility
    when 'anonymous' then 'Participante anônimo'
    when 'nickname' then coalesce(nullif(display_name, ''), 'Participante')
    when 'first_name' then split_part(full_name, ' ', 1)
    else full_name
  end,
  total_xp,
  total_seconds,
  current_streak,
  completed_days,
  case
    when total_xp >= 5500 then 7
    when total_xp >= 3600 then 6
    when total_xp >= 2200 then 5
    when total_xp >= 1250 then 4
    when total_xp >= 650 then 3
    when total_xp >= 250 then 2
    else 1
  end
from ranked
limit least(greatest(p_limit, 1), 100)
$$;

revoke all on function public.create_checkin(text, text, text, text, integer, text)
  from public, anon;
revoke all on function public.get_daily_checkin_status() from public, anon;
revoke all on function private.create_checkin_impl(text, text, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function private.get_daily_checkin_status_impl()
  from public, anon, authenticated;
revoke all on function private.validate_profile_timezone()
  from public, anon, authenticated;

grant execute on function public.create_checkin(text, text, text, text, integer, text)
  to authenticated;
grant execute on function public.get_daily_checkin_status() to authenticated;
grant execute on function private.create_checkin_impl(text, text, text, text, integer, text)
  to authenticated;
grant execute on function private.get_daily_checkin_status_impl() to authenticated;
grant execute on function private.validate_profile_timezone() to authenticated;
