create table public.feedback_submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  category text not null,
  message text not null,
  rating smallint,
  source text not null,
  created_at timestamptz not null default now(),
  constraint feedback_submissions_user_request_key unique (user_id, request_id),
  constraint feedback_submissions_category_check
    check (category in ('suggestion', 'problem', 'compliment', 'other')),
  constraint feedback_submissions_message_check
    check (char_length(btrim(message)) between 10 and 2000),
  constraint feedback_submissions_rating_check
    check (rating is null or rating between 1 and 5),
  constraint feedback_submissions_source_check
    check (source like '/%' and char_length(source) between 1 and 200)
);

comment on table public.feedback_submissions is
  'Feedback enviado por usuários autenticados na aplicação LevelUp 100.';
comment on column public.feedback_submissions.request_id is
  'Identificador idempotente gerado pelo cliente para impedir registros duplicados.';

create index feedback_submissions_user_created_at_idx
  on public.feedback_submissions (user_id, created_at desc);

alter table public.feedback_submissions enable row level security;

create policy feedback_submissions_insert_own
  on public.feedback_submissions
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

revoke all on table public.feedback_submissions from public, anon, authenticated;
grant insert on table public.feedback_submissions to authenticated;
grant usage on sequence public.feedback_submissions_id_seq to authenticated;
