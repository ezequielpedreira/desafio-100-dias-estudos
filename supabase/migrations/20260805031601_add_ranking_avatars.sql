drop function if exists public.get_ranking(integer);
drop function if exists private.get_ranking_impl(integer);

create or replace function private.get_ranking_impl(p_limit integer default 50)
returns table(
  rank_position bigint,
  user_id uuid,
  display_name text,
  avatar_path text,
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
  completed as (
    select
      d.user_id,
      d.study_date,
      row_number() over (partition by d.user_id order by d.study_date desc) as rn,
      max(d.study_date) over (partition by d.user_id) as last_date
    from public.daily_progress d
    where d.is_completed
  ),
  streaks as (
    select
      user_id,
      count(*) filter (
        where last_date >= current_date - 1
          and study_date = last_date - (rn::integer - 1)
      )::integer as current_streak
    from completed
    group by user_id
  ),
  stats as (
    select
      p.id,
      p.full_name,
      p.display_name,
      p.avatar_url,
      p.ranking_visibility,
      coalesce(x.total_xp, 0)::bigint as total_xp,
      coalesce(d.total_seconds, 0)::bigint as total_seconds,
      coalesce(d.completed_days, 0)::bigint as completed_days,
      coalesce(s.current_streak, 0) as current_streak
    from public.profiles p
    cross join allowed
    left join lateral (
      select sum(amount)::bigint as total_xp
      from public.xp_transactions
      where user_id = p.id
    ) x on true
    left join lateral (
      select
        sum(total_duration_seconds)::bigint as total_seconds,
        count(*) filter (where is_completed)::bigint as completed_days
      from public.daily_progress
      where user_id = p.id
    ) d on true
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
    case when ranking_visibility = 'anonymous' then null else avatar_url end,
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
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.get_ranking(p_limit integer default 50)
returns table(
  rank_position bigint,
  user_id uuid,
  display_name text,
  avatar_path text,
  total_xp bigint,
  total_seconds bigint,
  current_streak integer,
  completed_days bigint,
  level integer
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_ranking_impl($1);
$$;

create or replace function private.avatar_is_ranking_visible(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id::text = split_part(object_name, '/', 1)
      and p.ranking_visibility not in ('hidden', 'anonymous')
  );
$$;

revoke all on function public.get_ranking(integer) from public, anon;
grant execute on function public.get_ranking(integer) to authenticated;

revoke all on function private.get_ranking_impl(integer) from public, anon, authenticated;
grant execute on function private.get_ranking_impl(integer) to authenticated;

revoke all on function private.avatar_is_ranking_visible(text) from public, anon, authenticated;
grant execute on function private.avatar_is_ranking_visible(text) to authenticated;

drop policy if exists avatars_select_ranking_visible on storage.objects;
create policy avatars_select_ranking_visible
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and private.avatar_is_ranking_visible(name)
);
