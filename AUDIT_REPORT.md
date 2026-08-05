# Relatório de auditoria e estabilização

Data: 5 de agosto de 2026
Projeto: `desafio-100-dias-estudos`

## Problemas encontrados

- O backend bloqueava apenas uma sessão simultânea; após finalizar, o usuário podia fazer outro check-in no mesmo dia.
- Não havia constraint canônica `(user_id, data do check-in)` nem resposta idempotente para requisições concorrentes.
- Dashboard, jornada, sessões, ranking, conquistas, perfil e shell exibiam dados fictícios fixos.
- O perfil aparentava salvar, mas só mostrava um toast; tema, filtros secundários e vários controles não tinham persistência/efeito real.
- O tema escuro existia parcialmente no CSS, sem seletor global, persistência ou proteção contra flash.
- A recuperação de senha apontava para uma rota inexistente.
- Login ignorava `redirectTo`; havia um link de demonstração que levava a uma rota protegida.
- A página inicial possuía um botão de check-in sem ação e métricas fictícias.
- Ausência de cabeçalhos de segurança e CSP.
- Três sessões de teste (`dsd`, `sd`, `sds`) e seus XP/progresso permaneciam no banco de produção.
- O Supabase Auth mantém a proteção contra senhas vazadas desabilitada.
- A suíte inicial cobria somente cronômetro, XP e níveis.

## Correções realizadas

- Criada `daily_checkins`, com timestamps, fuso IANA, RLS, FKs e constraint única `daily_checkins_user_date_key`.
- Reescrita `create_checkin` como operação atômica: data do servidor, `ON CONFLICT`, apenas uma sessão criada e resposta controlada em duplicatas.
- Criada `get_daily_checkin_status`; o frontend consulta o servidor no carregamento e bloqueia o botão após o check-in.
- Estados do botão: `Fazer check-in`, `Registrando...`, `Check-in concluído`; todos desabilitam corretamente durante bloqueio/processamento.
- Sequência e dias concluídos passaram a usar check-ins canônicos.
- Conquistas passaram a ser concedidas automaticamente por triggers idempotentes de check-in/check-out.
- Todas as telas autenticadas usam consultas reais via `src/lib/app-data.ts`; `src/lib/demo-data.ts` foi removido.
- Perfil passou a salvar por Server Action com autenticação, Zod, allowlist de campos e validação também no banco.
- Implementados filtros reais de sessões, busca sem diferenciação de acento/caixa, limpeza e ordenações reais do ranking.
- Tema claro/escuro global, padrão claro, persistido em `localStorage` e aplicado antes da hidratação.
- Criada rota `/reset-password`; login respeita redirect seguro e usuários autenticados não retornam ao login.
- Página inicial deixou de exibir métricas e botões fictícios.
- Adicionados CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção e remoção de `X-Powered-By`.
- Removidos somente os três registros de teste confirmados, com cascata para check-ins/XP e limpeza do progresso derivado. Perfil, conta, desafio e configurações foram preservados.

## Segurança implementada

- RLS em todas as tabelas públicas, inclusive `daily_checkins`.
- Autorização por `auth.uid()` nas RPCs e Server Actions.
- Funções privilegiadas no schema `private`, `search_path=''` e privilégios revogados.
- Queries parametrizadas pelo cliente Supabase; nenhuma concatenação SQL de entrada do usuário.
- Constraints de tamanho, domínio, unicidade, FKs e validação de fuso oficial.
- Idempotência em check-in, check-out, XP e conquistas.
- Proteção contra open redirect em login e callback.
- Validação frontend + backend, bloqueio de envio repetido e mensagens sem detalhes internos.
- Segredos permanecem fora do frontend; `.env.example` contém somente nomes/valores de exemplo.
- `npm audit --omit=dev`: 0 vulnerabilidades conhecidas.

Limitação de CSP: o script mínimo que aplica o tema antes da pintura exige `unsafe-inline`; a evolução recomendada é CSP com nonce por requisição.

## Testes executados

| Verificação | Resultado |
|---|---|
| `npm install` | concluído; lockfile consistente e dependências já atualizadas |
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | 15 testes, 2 arquivos, passou |
| `npm run build` | passou; 13 rotas compiladas |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| Transação remota de idempotência | 1 check-in, 1 sessão e 1 XP após duas chamadas; rollback aplicado |
| Transação remota de conquistas | primeiro check-in e primeiro check-out concedidos; rollback aplicado |
| Constraint/histórico remoto | quantidade igual a pares distintos; sem sessão canônica ausente |
| Advisors do Supabase | sem erro de RLS; 1 aviso externo de Auth |
| Navegador desktop | todas as páginas, filtros, perfil, tema, 404 e console verificados |
| Navegador mobile | 375 px, menu funcional e sem overflow horizontal |
| Rota privada sem cookie | HTTP 307 para `/login?redirectTo=%2Fapp` |
| `npm run test:db` | suíte criada; não executada localmente porque o Docker/Supabase local não estava ativo |

O teste SQL em `supabase/tests/daily_checkin.sql` cobre primeiro/segundo check-in, dois usuários, próximo dia, fusos, unicidade e ausência de duplicidade. A concorrência real é serializada pela constraint única; a tentativa duplicada retorna o registro existente.

## Pendências

- Habilitar **Leaked Password Protection** no painel do Supabase Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Iniciar Docker + `npx supabase start` para executar `npm run test:db` localmente.
- Configurar domínio final na Vercel, `NEXT_PUBLIC_SITE_URL`, Redirect URLs do Supabase e Google antes do deploy.
- Confirmar política de backup/retention do plano Supabase e realizar teste de restauração em homologação.
- Índices novos aparecem como “unused” no advisor por o banco ainda estar vazio; não foram removidos prematuramente.

## Como executar

```bash
npm install
copy .env.example .env.local
npm run dev

npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev

npx supabase start
npm run test:db
```

Para aplicar migrations em um projeto vinculado:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

## Variáveis de ambiente

Consulte `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
