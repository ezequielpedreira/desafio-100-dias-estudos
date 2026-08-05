-- LevelUp 100: schema inicial, segurança e operações transacionais.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  display_name text check (char_length(display_name) <= 50),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 160),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) <= 80),
  daily_goal_minutes integer not null default 45 check (daily_goal_minutes between 1 and 600),
  main_study_goal text check (char_length(main_study_goal) <= 300),
  priority_subject text check (char_length(priority_subject) <= 80),
  ranking_visibility text not null default 'first_name' check (ranking_visibility in ('full_name','first_name','nickname','anonymous','hidden')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Desafio LevelUp 100' check (char_length(name) <= 100),
  start_date date not null, end_date date not null, total_days integer not null default 100 check (total_days between 1 and 365),
  status text not null default 'active' check (status in ('scheduled','active','completed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint challenges_valid_dates check (end_date >= start_date)
);
create unique index one_open_challenge_per_user on public.challenges(user_id) where status in ('scheduled','active');

create table public.study_categories (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80), icon text not null default 'book-open' check (char_length(icon) <= 50),
  is_system boolean not null default false, created_at timestamptz not null default now(),
  constraint category_owner_matches_type check ((is_system and user_id is null) or (not is_system and user_id is not null))
);
create unique index unique_system_category_name on public.study_categories(lower(name)) where is_system;
create unique index unique_user_category_name on public.study_categories(user_id,lower(name)) where not is_system;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade, category_id uuid references public.study_categories(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120), planned_content text not null check (char_length(planned_content) between 1 and 500),
  planned_objective text not null check (char_length(planned_objective) between 1 and 500), planned_minutes integer not null check (planned_minutes between 1 and 600),
  actual_content text check (char_length(actual_content) <= 1000), goal_achieved boolean, learning_summary text check (char_length(learning_summary) <= 1000),
  difficulty text check (char_length(difficulty) <= 500), rating integer check (rating between 1 and 5), notes text check (char_length(notes) <= 1000),
  checkout_notes text check (char_length(checkout_notes) <= 1000), status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  started_at timestamptz not null default now(), paused_at timestamptz, finished_at timestamptz,
  accumulated_pause_seconds integer not null default 0 check (accumulated_pause_seconds >= 0), effective_duration_seconds integer not null default 0 check (effective_duration_seconds >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_session_per_user on public.study_sessions(user_id) where status in ('active','paused');
create index study_sessions_user_started_idx on public.study_sessions(user_id,started_at desc);

create table public.session_pauses (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, paused_at timestamptz not null default now(), resumed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0), created_at timestamptz not null default now()
);
create unique index one_open_pause_per_session on public.session_pauses(session_id) where resumed_at is null;

create table public.daily_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade, study_date date not null, challenge_day integer not null check (challenge_day between 1 and 365),
  total_duration_seconds integer not null default 0 check (total_duration_seconds >= 0), session_count integer not null default 0 check (session_count >= 0),
  is_completed boolean not null default false, xp_earned integer not null default 0 check (xp_earned >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,challenge_id,study_date)
);
create index daily_progress_ranking_idx on public.daily_progress(user_id,is_completed,study_date desc);

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.study_sessions(id) on delete cascade, challenge_id uuid references public.challenges(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('checkin','checkout','study_time','goal_bonus','streak_bonus','achievement','challenge_complete')),
  amount integer not null check (amount > 0), description text not null check (char_length(description) <= 200), idempotency_key text not null unique check (char_length(idempotency_key) <= 200),
  created_at timestamptz not null default now()
);
create index xp_transactions_user_created_idx on public.xp_transactions(user_id,created_at desc);

create table public.achievements (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9-]+$'), name text not null check (char_length(name) <= 80),
  description text not null check (char_length(description) <= 250), icon text not null check (char_length(icon) <= 50), xp_reward integer not null default 0 check (xp_reward >= 0),
  condition_type text not null, condition_value integer not null default 1 check (condition_value >= 0), is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade, unlocked_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(user_id,achievement_id)
);

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end;$$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger challenges_touch before update on public.challenges for each row execute function private.touch_updated_at();
create trigger sessions_touch before update on public.study_sessions for each row execute function private.touch_updated_at();
create trigger progress_touch before update on public.daily_progress for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.assert_user() returns uuid language plpgsql stable security invoker set search_path='' as $$
declare v_user uuid := (select auth.uid()); begin if v_user is null then raise exception 'Autenticação obrigatória' using errcode='28000';end if;return v_user;end;$$;

create or replace function private.complete_onboarding_impl(p_main_study_goal text,p_priority_subject text,p_daily_goal_minutes integer,p_start_date date,p_ranking_visibility text,p_display_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.assert_user();v_challenge uuid;
begin
  if p_daily_goal_minutes not between 1 and 600 or p_start_date is null or p_ranking_visibility not in ('full_name','first_name','nickname','anonymous','hidden') then raise exception 'Dados de onboarding inválidos';end if;
  update public.profiles set main_study_goal=left(trim(p_main_study_goal),300),priority_subject=left(trim(p_priority_subject),80),daily_goal_minutes=p_daily_goal_minutes,display_name=nullif(left(trim(p_display_name),50),''),ranking_visibility=p_ranking_visibility,onboarding_completed=true where id=v_user;
  insert into public.challenges(user_id,start_date,end_date,status) values(v_user,p_start_date,p_start_date+99,case when p_start_date>current_date then 'scheduled' else 'active' end)
  on conflict(user_id) where status in ('scheduled','active') do update set start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status,updated_at=now() returning id into v_challenge;
  return v_challenge;
end;$$;

create or replace function public.complete_onboarding(p_main_study_goal text,p_priority_subject text,p_daily_goal_minutes integer,p_start_date date,p_ranking_visibility text,p_display_name text)
returns uuid language sql security invoker set search_path='' as $$select private.complete_onboarding_impl($1,$2,$3,$4,$5,$6)$$;

create or replace function private.create_checkin_impl(p_title text,p_planned_content text,p_planned_objective text,p_category_name text,p_planned_minutes integer,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.assert_user();v_challenge uuid;v_category uuid;v_session uuid;
begin
  if p_planned_minutes not between 1 and 600 or char_length(trim(p_title)) not between 1 and 120 then raise exception 'Dados de check-in inválidos';end if;
  select id into v_challenge from public.challenges where user_id=v_user and status in('active','scheduled') and start_date<=current_date and end_date>=current_date order by created_at desc limit 1;
  if v_challenge is null then raise exception 'Nenhum desafio ativo';end if;
  if exists(select 1 from public.study_sessions where user_id=v_user and status in('active','paused')) then raise exception 'Já existe uma sessão em andamento';end if;
  select id into v_category from public.study_categories where lower(name)=lower(trim(p_category_name)) and (is_system or user_id=v_user) order by is_system desc limit 1;
  insert into public.study_sessions(user_id,challenge_id,category_id,title,planned_content,planned_objective,planned_minutes,notes,started_at)
  values(v_user,v_challenge,v_category,left(trim(p_title),120),left(trim(p_planned_content),500),left(trim(p_planned_objective),500),p_planned_minutes,left(p_notes,1000),clock_timestamp()) returning id into v_session;
  insert into public.xp_transactions(user_id,session_id,challenge_id,transaction_type,amount,description,idempotency_key) values(v_user,v_session,v_challenge,'checkin',10,'Check-in realizado','session:'||v_session||':checkin') on conflict(idempotency_key) do nothing;
  return v_session;
end;$$;
create or replace function public.create_checkin(p_title text,p_planned_content text,p_planned_objective text,p_category_name text,p_planned_minutes integer,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$select private.create_checkin_impl($1,$2,$3,$4,$5,$6)$$;

create or replace function private.pause_session_impl(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.assert_user();begin
  update public.study_sessions set status='paused',paused_at=clock_timestamp() where id=p_session_id and user_id=v_user and status='active';
  if not found then raise exception 'Sessão não está ativa';end if;
  insert into public.session_pauses(session_id,user_id,paused_at) values(p_session_id,v_user,clock_timestamp());
end;$$;
create or replace function public.pause_study_session(p_session_id uuid) returns void language sql security invoker set search_path='' as $$select private.pause_session_impl($1)$$;

create or replace function private.resume_session_impl(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.assert_user();v_pause public.session_pauses%rowtype;v_now timestamptz:=clock_timestamp();v_seconds integer;
begin
  select * into v_pause from public.session_pauses where session_id=p_session_id and user_id=v_user and resumed_at is null for update;
  if not found then raise exception 'Sessão não está pausada';end if;
  v_seconds:=greatest(0,floor(extract(epoch from(v_now-v_pause.paused_at)))::integer);
  update public.session_pauses set resumed_at=v_now,duration_seconds=v_seconds where id=v_pause.id;
  update public.study_sessions set status='active',paused_at=null,accumulated_pause_seconds=accumulated_pause_seconds+v_seconds where id=p_session_id and user_id=v_user and status='paused';
  if not found then raise exception 'Sessão não está pausada';end if;
end;$$;
create or replace function public.resume_study_session(p_session_id uuid) returns void language sql security invoker set search_path='' as $$select private.resume_session_impl($1)$$;

create or replace function private.finish_session_impl(p_session_id uuid,p_actual_content text,p_goal_achieved boolean,p_learning_summary text,p_difficulty text,p_rating integer,p_checkout_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.assert_user();s public.study_sessions%rowtype;v_now timestamptz:=clock_timestamp();v_pause integer:=0;v_duration integer;v_minutes integer;v_xp integer:=0;v_day integer;v_date date;v_completed boolean;
begin
  select * into s from public.study_sessions where id=p_session_id and user_id=v_user for update;
  if not found then raise exception 'Sessão não encontrada';end if;
  if s.status='completed' then select coalesce(sum(amount),0) into v_xp from public.xp_transactions where session_id=s.id;return jsonb_build_object('session_id',s.id,'duration_seconds',s.effective_duration_seconds,'xp_earned',v_xp,'idempotent',true);end if;
  if s.status not in('active','paused') then raise exception 'Sessão não pode ser finalizada';end if;
  if s.paused_at is not null then v_pause:=greatest(0,floor(extract(epoch from(v_now-s.paused_at)))::integer);update public.session_pauses set resumed_at=v_now,duration_seconds=v_pause where session_id=s.id and resumed_at is null;end if;
  v_duration:=greatest(0,floor(extract(epoch from(v_now-s.started_at)))::integer-s.accumulated_pause_seconds-v_pause);v_minutes:=floor(v_duration/60);v_completed:=v_minutes>=1;
  update public.study_sessions set status='completed',finished_at=v_now,paused_at=null,accumulated_pause_seconds=s.accumulated_pause_seconds+v_pause,effective_duration_seconds=v_duration,actual_content=left(trim(p_actual_content),1000),goal_achieved=p_goal_achieved,learning_summary=left(trim(p_learning_summary),1000),difficulty=left(trim(p_difficulty),500),rating=p_rating,checkout_notes=left(trim(p_checkout_notes),1000) where id=s.id;
  v_date:=(s.started_at at time zone coalesce((select timezone from public.profiles where id=v_user),'America/Sao_Paulo'))::date;select (v_date-start_date)+1 into v_day from public.challenges where id=s.challenge_id;
  insert into public.xp_transactions(user_id,session_id,challenge_id,transaction_type,amount,description,idempotency_key) values(v_user,s.id,s.challenge_id,'checkout',20,'Check-out concluído','session:'||s.id||':checkout') on conflict(idempotency_key) do nothing;
  if v_minutes>=10 then insert into public.xp_transactions(user_id,session_id,challenge_id,transaction_type,amount,description,idempotency_key) values(v_user,s.id,s.challenge_id,'study_time',floor(v_minutes/10)*5,'XP por tempo estudado','session:'||s.id||':time') on conflict(idempotency_key) do nothing;end if;
  if p_goal_achieved and v_minutes>=s.planned_minutes then insert into public.xp_transactions(user_id,session_id,challenge_id,transaction_type,amount,description,idempotency_key) values(v_user,s.id,s.challenge_id,'goal_bonus',20,'Meta de tempo concluída','session:'||s.id||':goal') on conflict(idempotency_key) do nothing;end if;
  insert into public.daily_progress(user_id,challenge_id,study_date,challenge_day,total_duration_seconds,session_count,is_completed,xp_earned)
  values(v_user,s.challenge_id,v_date,v_day,v_duration,1,v_completed,0) on conflict(user_id,challenge_id,study_date) do update set total_duration_seconds=public.daily_progress.total_duration_seconds+excluded.total_duration_seconds,session_count=public.daily_progress.session_count+1,is_completed=public.daily_progress.is_completed or excluded.is_completed;
  select coalesce(sum(amount),0) into v_xp from public.xp_transactions where session_id=s.id;update public.daily_progress set xp_earned=(select coalesce(sum(x.amount),0) from public.xp_transactions x where x.user_id=v_user and x.challenge_id=s.challenge_id and (x.created_at at time zone coalesce((select timezone from public.profiles where id=v_user),'America/Sao_Paulo'))::date=v_date) where user_id=v_user and challenge_id=s.challenge_id and study_date=v_date;
  return jsonb_build_object('session_id',s.id,'duration_seconds',v_duration,'xp_earned',v_xp,'day_completed',v_completed,'idempotent',false);
end;$$;
create or replace function public.finish_study_session(p_session_id uuid,p_actual_content text,p_goal_achieved boolean,p_learning_summary text,p_difficulty text default null,p_rating integer default null,p_checkout_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$select private.finish_session_impl($1,$2,$3,$4,$5,$6,$7)$$;

create or replace function private.get_ranking_impl(p_limit integer default 50)
returns table(rank_position bigint,user_id uuid,display_name text,total_xp bigint,total_seconds bigint,current_streak integer,completed_days bigint,level integer)
language sql security definer set search_path='' as $$
with allowed as(select private.assert_user()),
completed as(select d.user_id,d.study_date,row_number() over(partition by d.user_id order by d.study_date desc) rn,max(d.study_date) over(partition by d.user_id) last_date from public.daily_progress d where d.is_completed),
streaks as(select user_id,count(*) filter(where last_date>=current_date-1 and study_date=last_date-(rn::integer-1))::integer current_streak from completed group by user_id),
stats as(select p.id,p.full_name,p.display_name,p.ranking_visibility,coalesce(x.total_xp,0)::bigint total_xp,coalesce(d.total_seconds,0)::bigint total_seconds,coalesce(d.completed_days,0)::bigint completed_days,coalesce(s.current_streak,0) current_streak from public.profiles p cross join allowed left join lateral(select sum(amount)::bigint total_xp from public.xp_transactions where user_id=p.id)x on true left join lateral(select sum(total_duration_seconds)::bigint total_seconds,count(*) filter(where is_completed)::bigint completed_days from public.daily_progress where user_id=p.id)d on true left join streaks s on s.user_id=p.id where p.ranking_visibility<>'hidden'),
ranked as(select row_number() over(order by total_xp desc,completed_days desc,total_seconds desc,id) rank_position,* from stats)
select rank_position,id,case ranking_visibility when 'anonymous' then 'Participante anônimo' when 'nickname' then coalesce(nullif(display_name,''),'Participante') when 'first_name' then split_part(full_name,' ',1) else full_name end,total_xp,total_seconds,current_streak,completed_days,case when total_xp>=5500 then 7 when total_xp>=3600 then 6 when total_xp>=2200 then 5 when total_xp>=1250 then 4 when total_xp>=650 then 3 when total_xp>=250 then 2 else 1 end from ranked limit least(greatest(p_limit,1),100);
$$;
create or replace function public.get_ranking(p_limit integer default 50) returns table(rank_position bigint,user_id uuid,display_name text,total_xp bigint,total_seconds bigint,current_streak integer,completed_days bigint,level integer) language sql security invoker set search_path='' as $$select * from private.get_ranking_impl($1)$$;

alter table public.profiles enable row level security;alter table public.challenges enable row level security;alter table public.study_categories enable row level security;alter table public.study_sessions enable row level security;alter table public.session_pauses enable row level security;alter table public.daily_progress enable row level security;alter table public.xp_transactions enable row level security;alter table public.achievements enable row level security;alter table public.user_achievements enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using((select auth.uid())=id);
create policy profiles_update_own on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy challenges_own on public.challenges for select to authenticated using((select auth.uid())=user_id);
create policy categories_read on public.study_categories for select to authenticated using(is_system or (select auth.uid())=user_id);
create policy categories_insert_own on public.study_categories for insert to authenticated with check(not is_system and (select auth.uid())=user_id);
create policy categories_update_own on public.study_categories for update to authenticated using(not is_system and (select auth.uid())=user_id) with check(not is_system and (select auth.uid())=user_id);
create policy sessions_own on public.study_sessions for select to authenticated using((select auth.uid())=user_id);
create policy pauses_own on public.session_pauses for select to authenticated using((select auth.uid())=user_id);
create policy progress_own on public.daily_progress for select to authenticated using((select auth.uid())=user_id);
create policy xp_own on public.xp_transactions for select to authenticated using((select auth.uid())=user_id);
create policy achievements_read on public.achievements for select to authenticated using(is_active);
create policy user_achievements_own on public.user_achievements for select to authenticated using((select auth.uid())=user_id);

revoke all on all tables in schema public from anon,authenticated;
grant select,update on public.profiles to authenticated;grant select on public.challenges,public.study_sessions,public.session_pauses,public.daily_progress,public.xp_transactions,public.achievements,public.user_achievements to authenticated;grant select,insert,update,delete on public.study_categories to authenticated;
revoke all on all functions in schema public from public,anon;revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.complete_onboarding(text,text,integer,date,text,text) to authenticated;
grant execute on function public.create_checkin(text,text,text,text,integer,text) to authenticated;
grant execute on function public.pause_study_session(uuid) to authenticated;grant execute on function public.resume_study_session(uuid) to authenticated;
grant execute on function public.finish_study_session(uuid,text,boolean,text,text,integer,text) to authenticated;grant execute on function public.get_ranking(integer) to authenticated;
grant execute on function private.complete_onboarding_impl(text,text,integer,date,text,text),private.create_checkin_impl(text,text,text,text,integer,text),private.pause_session_impl(uuid),private.resume_session_impl(uuid),private.finish_session_impl(uuid,text,boolean,text,text,integer,text),private.get_ranking_impl(integer),private.assert_user() to authenticated;

insert into public.study_categories(name,icon,is_system) values ('Power BI','chart-no-axes-column',true),('SQL','database',true),('Python','code-xml',true),('Excel','sheet',true),('Inglês','languages',true),('Faculdade','graduation-cap',true),('Certificação','badge-check',true),('Leitura','book-open',true),('Projeto pessoal','rocket',true),('Outro','shapes',true) on conflict do nothing;
insert into public.achievements(slug,name,description,icon,xp_reward,condition_type,condition_value) values
('first-checkin','Primeiro passo','Faça seu primeiro check-in','flag',0,'checkins',1),('first-checkout','Missão cumprida','Conclua sua primeira sessão','check',0,'checkouts',1),('week-streak','Uma semana firme','Mantenha 7 dias de sequência','flame',50,'streak',7),('ten-days','Dez dias de foco','Conclua 10 dias','target',0,'completed_days',10),('marathon','Maratonista','Estude mais de 2 horas em uma sessão','timer',0,'session_minutes',120),('consistent','Consistente','Conclua 25 dias','shield',0,'completed_days',25),('halfway','Metade do caminho','Conclua 50 dias','mountain',0,'completed_days',50),('final-stretch','Reta final','Conclua 75 dias','rocket',0,'completed_days',75),('complete','Jornada completa','Conclua os 100 dias','trophy',1000,'completed_days',100),('early-bird','Madrugador','Comece antes das 7h','sunrise',0,'start_hour_before',7),('night-owl','Coruja','Finalize depois das 23h','moon',0,'finish_hour_after',23) on conflict(slug) do nothing;
