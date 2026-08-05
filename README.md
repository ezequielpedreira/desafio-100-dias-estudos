# LevelUp 100

Aplicação gamificada para transformar estudo em consistência ao longo de um desafio de 100 dias. O produto usa dados reais do Supabase: não existe modo de demonstração nem catálogo fictício nas telas autenticadas.

## Funcionalidades

- Login por e-mail ou Google, cadastro, logout e recuperação segura de senha.
- Onboarding com objetivo, tema prioritário, meta diária, data de início e privacidade.
- Check-in permitido uma única vez por usuário/dia, com data calculada no servidor.
- Cronômetro persistente, pausa, retomada e recuperação após recarregar a página.
- Check-out idempotente com duração e XP calculados no banco.
- Dashboard, jornada, histórico, ranking, conquistas e perfil alimentados pelo Supabase.
- Tema claro (padrão) e escuro, com preferência persistida no navegador.
- RLS, RPCs transacionais, constraints, CSP e cabeçalhos de segurança.
- Interface responsiva, navegação por teclado, foco visível e redução de movimento.

## Stack

- Next.js 16.3 (App Router e `proxy.ts`), React 19.2 e TypeScript estrito.
- Tailwind CSS 4, Lucide Icons e Sonner.
- Supabase Auth, PostgreSQL, RLS e RPCs PL/pgSQL.
- Zod para validação de autenticação e perfil.
- Vitest e testes SQL de integração.
- Hospedagem planejada: Vercel; banco e autenticação: Supabase Cloud.

## Instalação

Pré-requisitos: Node.js 22.22+ (ou 24 LTS), npm 10+ e um projeto Supabase.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Projetos antigos podem usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nunca exponha `service_role`, secret keys ou senhas em variáveis `NEXT_PUBLIC_*`.

## Banco de dados

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

A tabela `daily_checkins` é a fonte canônica do check-in diário. A constraint `daily_checkins_user_date_key` garante unicidade por usuário/data. `create_checkin` insere com `ON CONFLICT`, retorna o registro existente em duplicatas e determina a data pelo fuso IANA salvo no perfil.

Todas as tabelas públicas usam RLS. Mutações críticas passam por RPCs que verificam `auth.uid()` e executam implementações privilegiadas no schema `private`.

## Qualidade e testes

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Para os testes SQL, inicie o Supabase local (Docker necessário):

```bash
npx supabase start
npm run test:db
```

## Configuração de autenticação

No painel do Supabase, configure a Site URL e as Redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://SEU-DOMINIO/auth/callback`

No Google Cloud, use como URI autorizada a callback exibida no provedor Google do Supabase. Para produção, atualize também `NEXT_PUBLIC_SITE_URL`.

## Deploy

1. Envie a branch revisada ao GitHub.
2. Importe o repositório na Vercel.
3. Cadastre as variáveis de ambiente.
4. Execute as migrations com `npx supabase db push`.
5. Atualize URLs de autenticação no Supabase e Google.
6. Execute `npm run build` antes de publicar.

## Backup e recuperação

Consulte [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) antes de migrations destrutivas ou mudanças de produção.

## Estrutura

```text
src/app/                  rotas, layouts e Server Actions
src/components/           componentes interativos e shell
src/lib/app-data.ts       leitura autenticada centralizada
src/lib/supabase/         clientes SSR/browser e proteção de rotas
supabase/migrations/      schema e mudanças versionadas
supabase/tests/           testes de integração do banco
```
