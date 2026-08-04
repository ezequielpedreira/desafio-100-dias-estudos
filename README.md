# LevelUp 100

**100 dias para transformar estudo em consistência.**

Aplicação web gamificada para acompanhar estudos em um desafio de 100 dias. O participante faz check-in, usa um cronômetro persistente, registra o check-out, acumula XP, acompanha a jornada e participa de um ranking com privacidade configurável.

## Funcionalidades

- Cadastro, login, recuperação de senha, confirmação de e-mail e sessão SSR.
- Onboarding com objetivo, assunto prioritário, meta diária, início e privacidade.
- Dashboard com dia atual, progresso, sequência, tempo, XP, nível e ranking.
- Check-in transacional e bloqueio de duas sessões simultâneas.
- Cronômetro baseado em timestamps do banco, com pausa, retomada e recuperação após reload.
- Check-out idempotente, duração efetiva calculada no servidor, XP e progresso diário.
- Mapa visual dos 100 dias e marcos da jornada.
- Histórico de sessões, filtros, conquistas, ranking e perfil.
- Navegação responsiva, acessibilidade e respeito a `prefers-reduced-motion`.
- Modo de demonstração somente para desenvolvimento, sem inserir dados fictícios no banco.

## Stack

- Next.js 16 (App Router e `proxy.ts`), React 19 e TypeScript.
- Tailwind CSS 4, componentes no padrão shadcn/ui e Lucide Icons.
- Supabase Auth, PostgreSQL, RPCs transacionais e Row Level Security.
- React Hook Form/Zod disponíveis para evolução dos formulários; validação Zod já aplicada no fluxo de autenticação.
- date-fns, Recharts e Sonner.
- Vitest para regras puras.

## Arquitetura

```text
src/
  app/                 rotas, layouts, estados de erro e autenticação
    actions/           Server Actions de autenticação
    app/               área privada e páginas do produto
    auth/callback/     troca de código PKCE por sessão
  components/          shell, identidade e fluxo de estudo
  lib/
    supabase/           clientes browser/server e renovação no proxy
    game.ts             níveis, XP e duração efetiva
supabase/
  migrations/          schema, constraints, RLS e RPCs
  seed.sql              política de dados de desenvolvimento
```

As sessões autenticadas usam cookies via `@supabase/ssr`. O `src/proxy.ts` renova os tokens e encaminha os cabeçalhos anti-cache exigidos pelo Supabase. As ações críticas passam por wrappers RPC públicos que chamam implementações `security definer` no schema privado, sempre verificando `auth.uid()` e com permissões explicitamente revogadas por padrão.

## Banco de dados

Tabelas: `profiles`, `challenges`, `study_categories`, `study_sessions`, `session_pauses`, `daily_progress`, `xp_transactions`, `achievements` e `user_achievements`.

Controles importantes:

- Índice parcial impede mais de uma sessão ativa/pausada por usuário.
- Índice parcial impede mais de um desafio aberto por usuário.
- Chaves únicas tornam XP, progresso diário e conquistas idempotentes.
- Duração e XP nunca são aceitos do navegador.
- Todas as tabelas públicas têm RLS habilitada.
- Dados detalhados são visíveis apenas ao proprietário.
- Ranking retorna somente nome autorizado e métricas agregadas; e-mail e sessões não são expostos.
- Funções privilegiadas ficam no schema `private`; wrappers públicos têm `EXECUTE` apenas para `authenticated`.

## Pré-requisitos

- Node.js 22.22+ ou 24 LTS.
- npm 10+.
- Supabase CLI para desenvolvimento local.
- Um projeto Supabase e, para publicação, uma conta Vercel.

## Instalação

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Sem credenciais, a página `/app` funciona em modo demonstração local. Em produção, não defina `NEXT_PUBLIC_DEMO_MODE`.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Projetos antigos podem usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nunca coloque `service_role` ou secret keys em variáveis `NEXT_PUBLIC_*`.

## Configuração do Supabase

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

No painel do Supabase, configure:

- Site URL: URL local ou de produção.
- Redirect URL: `http://localhost:3000/auth/callback` e a equivalente em produção.
- Confirmação de e-mail conforme a política do produto.
- SMTP próprio se quiser personalizar os e-mails em novos projetos Free.

A migration principal é `supabase/migrations/20260804204953_initial_levelup_schema.sql`.

## Testes e qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes unitários cobrem duração persistente, pausas, prevenção de valores negativos, regras de XP e níveis. Para testar RLS e transações em integração, suba o Supabase local e execute os fluxos com dois usuários autenticados; o projeto evita simular RLS apenas no cliente.

## Deploy na Vercel

1. Envie o repositório para o GitHub.
2. Importe o repositório na Vercel.
3. Cadastre as variáveis de ambiente acima.
4. Atualize `NEXT_PUBLIC_SITE_URL` para o domínio final.
5. Adicione a URL final às Redirect URLs do Supabase.
6. Execute `npm run build` e publique.

## Decisões técnicas

- Datas são gravadas em UTC (`timestamptz`) e os agregados diários usam o fuso do perfil.
- O cliente atualiza apenas a exibição do cronômetro a cada segundo; o banco recebe início, pausa, retomada e finalização.
- O ranking é calculado no servidor por RPC segura.
- Identidade, regras de nível e constantes ficam centralizadas em `src/lib`.
- A interface usa identidade original: roxo, amarelo, cartões marcantes e mascote vetorial construído em CSS.

## Limitações atuais

- O ambiente deste repositório não estava associado a um projeto Supabase adequado; a migration foi criada, mas não aplicada remotamente.
- Dados das páginas secundárias usam o catálogo de demonstração até a primeira conexão do projeto; o fluxo principal já chama RPCs reais.
- Upload de avatar, Google Login, notificações push e administração ficam fora do MVP.
- Testes completos de RLS exigem Supabase local (Docker) ou um branch de desenvolvimento remoto.

## Próximas evoluções

- Ligar todas as listagens aos dados reais e adicionar paginação por cursor.
- Executar avaliação automática de conquistas no check-out.
- Histórico de posição do ranking e gráficos reais por período.
- Upload de avatar, tema persistido e categorias personalizadas.
- Testes E2E com Playwright e suíte pgTAP para RLS/RPCs.
