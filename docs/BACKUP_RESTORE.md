# Backup e recuperação

## Política mínima

- Confirmar no painel do Supabase se backups automáticos estão ativos para o plano contratado.
- Gerar um dump lógico antes de toda migration destrutiva ou limpeza material.
- Armazenar backups fora do repositório, criptografados e com acesso restrito.
- Definir retenção conforme requisitos legais e de negócio; não manter dados pessoais indefinidamente.
- Testar a restauração em um projeto de homologação pelo menos trimestralmente.

## Backup lógico

Com o projeto vinculado e uma pasta segura fora do Git:

```bash
npx supabase db dump --linked --file backup-schema-and-data.sql
```

Para separar schema e dados, consulte `npx supabase db dump --help` da versão instalada. Nunca versione dumps com informações pessoais ou credenciais.

## Restauração segura

1. Criar ou selecionar um projeto de homologação vazio.
2. Confirmar que o destino não é produção.
3. Restaurar o dump com a ferramenta PostgreSQL compatível.
4. Executar `npx supabase db lint` e os testes de integração.
5. Comparar contagens, constraints, RLS, funções e amostras funcionais.
6. Somente depois planejar uma restauração de produção, com janela e plano de rollback.

Exemplo para um banco descartável:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backup-schema-and-data.sql
```

## Verificação pós-restauração

- Perfis e desafios preservados.
- `daily_checkins` sem duplicidade em `(user_id, checkin_date)`.
- Sessões, pausas, XP e conquistas com chaves estrangeiras válidas.
- RLS habilitada e políticas restritas ao proprietário.
- Login, check-in, check-out, histórico e ranking funcionando.
- Nenhum segredo presente em logs, dumps versionados ou frontend.
