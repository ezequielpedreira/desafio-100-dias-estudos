create or replace function private.avatar_is_ranking_visible(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id::text = split_part(object_name, '/', 1)
        and p.ranking_visibility not in ('hidden', 'anonymous')
    );
$$;

revoke all on function private.avatar_is_ranking_visible(text) from public, anon, authenticated;
grant execute on function private.avatar_is_ranking_visible(text) to authenticated;
