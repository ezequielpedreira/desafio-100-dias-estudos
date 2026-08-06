-- Execute somente em um banco local/descartável: `npm run test:db`.
-- Toda a preparação é revertida ao final.
begin;

do $$
declare
  v_user_1 constant uuid := '31111111-1111-4111-8111-111111111111';
  v_user_2 constant uuid := '32222222-2222-4222-8222-222222222222';
  v_request constant uuid := '33333333-3333-4333-8333-333333333333';
begin
  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'feedback_submissions'
  ) then
    raise exception 'RLS deve estar habilitado em feedback_submissions';
  end if;

  if has_table_privilege('anon', 'public.feedback_submissions', 'insert') then
    raise exception 'Usuários anônimos não podem inserir feedback';
  end if;
  if not has_table_privilege('authenticated', 'public.feedback_submissions', 'insert') then
    raise exception 'Usuários autenticados precisam da permissão de insert';
  end if;
  if has_table_privilege('authenticated', 'public.feedback_submissions', 'select') then
    raise exception 'O cliente não deve listar feedbacks';
  end if;

  delete from auth.users where id in (v_user_1, v_user_2);
  insert into auth.users(
    id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (v_user_1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-1@example.test', '{}', '{}', now(), now()),
    (v_user_2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-2@example.test', '{}', '{}', now(), now());

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_1, 'role', 'authenticated')::text,
    true
  );

  set local role authenticated;
  insert into public.feedback_submissions(
    user_id, request_id, category, message, rating, source
  ) values (
    v_user_1, v_request, 'suggestion', 'Mensagem válida para o teste do banco.', 5, '/app'
  );

  begin
    insert into public.feedback_submissions(
      user_id, request_id, category, message, rating, source
    ) values (
      v_user_1, v_request, 'suggestion', 'Repetição da mesma solicitação.', 5, '/app'
    );
    raise exception 'A mesma solicitação criou um feedback duplicado';
  exception when unique_violation then null;
  end;

  begin
    insert into public.feedback_submissions(
      user_id, request_id, category, message, rating, source
    ) values (
      v_user_2, gen_random_uuid(), 'problem', 'Tentativa de gravar para outro usuário.', 1, '/app'
    );
    raise exception 'A política permitiu inserir feedback para outro usuário';
  exception when insufficient_privilege then null;
  end;

  reset role;
  if (
    select count(*)
    from public.feedback_submissions
    where user_id = v_user_1 and request_id = v_request
  ) <> 1 then
    raise exception 'O histórico contém registros ausentes ou duplicados';
  end if;
  if (
    select created_at is null
    from public.feedback_submissions
    where user_id = v_user_1 and request_id = v_request
  ) then
    raise exception 'O horário de criação deve ser preenchido pelo banco';
  end if;
end;
$$;

rollback;
