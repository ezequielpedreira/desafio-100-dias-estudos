-- Execute somente em um banco local/descartável: `npm run test:db`.
-- Toda a preparação é revertida ao final.
begin;

do $$
declare
  v_user_1 constant uuid := '11111111-1111-4111-8111-111111111111';
  v_user_2 constant uuid := '22222222-2222-4222-8222-222222222222';
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_first jsonb;
  v_second jsonb;
  v_challenge uuid;
begin
  delete from auth.users where id in (v_user_1, v_user_2);
  insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_user_1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkin-1@example.test', '{}', '{"full_name":"Teste Um"}', now(), now()),
    (v_user_2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkin-2@example.test', '{}', '{"full_name":"Teste Dois"}', now(), now());

  perform set_config('request.jwt.claims', json_build_object('sub', v_user_1, 'role', 'authenticated')::text, true);
  perform public.complete_onboarding('Teste de check-in', 'SQL', 45, v_today, 'hidden', 'Teste Um');
  v_first := public.create_checkin('Primeira sessão', 'Conteúdo', 'Objetivo', 'SQL', 45, null);
  v_second := public.create_checkin('Tentativa duplicada', 'Conteúdo', 'Objetivo', 'SQL', 45, null);

  if not (v_first->>'created')::boolean then raise exception 'O primeiro check-in deveria ser criado'; end if;
  if (v_second->>'created')::boolean or not (v_second->>'already_checked_in')::boolean then raise exception 'A segunda tentativa deveria ser idempotente'; end if;
  if (select count(*) from public.daily_checkins where user_id = v_user_1 and checkin_date = v_today) <> 1 then raise exception 'Histórico duplicado para o usuário 1'; end if;
  if (select count(*) from public.study_sessions where user_id = v_user_1) <> 1 then raise exception 'Duplo clique criou duas sessões'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user_2, 'role', 'authenticated')::text, true);
  perform public.complete_onboarding('Teste de check-in', 'SQL', 45, v_today, 'hidden', 'Teste Dois');
  perform public.create_checkin('Sessão do segundo usuário', 'Conteúdo', 'Objetivo', 'SQL', 45, null);
  if (select count(*) from public.daily_checkins where checkin_date = v_today and user_id in (v_user_1, v_user_2)) <> 2 then raise exception 'Usuários diferentes deveriam conseguir fazer check-in'; end if;

  select id into v_challenge from public.challenges where user_id = v_user_1;
  insert into public.daily_checkins(user_id, challenge_id, checkin_date) values (v_user_1, v_challenge, v_today + 1);
  if (select count(*) from public.daily_checkins where user_id = v_user_1) <> 2 then raise exception 'O próximo dia deveria aceitar novo check-in'; end if;

  if (timestamptz '2026-01-01 02:30:00+00' at time zone 'America/Sao_Paulo')::date <> date '2025-12-31' then raise exception 'Conversão de fuso America/Sao_Paulo incorreta'; end if;
  if (timestamptz '2026-01-01 02:30:00+00' at time zone 'Pacific/Kiritimati')::date <> date '2026-01-01' then raise exception 'Conversão de fuso Pacific/Kiritimati incorreta'; end if;

  begin
    insert into public.daily_checkins(user_id, challenge_id, checkin_date) values (v_user_1, v_challenge, v_today);
    raise exception 'A restrição única não bloqueou a concorrência';
  exception when unique_violation then null;
  end;
end;
$$;

rollback;
