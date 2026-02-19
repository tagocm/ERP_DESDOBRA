# DB Runbook (Supabase / Desdobra)

## Comandos do dia-a-dia

### Reset completo (recria e roda seed)
```bash
npx supabase db reset
```

### Subir stack local
```bash
npx supabase start
```

### Parar
```bash
npx supabase stop
```

## Debug de migrations

### Rodar com mais log
```bash
npx supabase db reset --debug
```

### Encontrar o arquivo que quebrou
O CLI normalmente imprime "Applying migration <arquivo>..."
O erro logo abaixo aponta o SQL/linha/objeto.

## Ver objetos do schema (Postgres)

Entre no container/psql (ajuste conforme seu setup):

```bash
npx supabase status
# pegue DB URL e conecte via psql
```

### Consultas úteis

```sql
-- Listar enums
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE t.typtype='e' AND n.nspname='public'
ORDER BY 1;

-- Ver valores de um enum
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid=e.enumtypid
WHERE t.typname = 'sales_commercial_status'
ORDER BY enumsortorder;

-- Listar triggers de uma tabela
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.sales_documents'::regclass
AND NOT tgisinternal
ORDER BY 1;

-- Listar views
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema='public'
ORDER BY 1,2;
```

## Debug de seed

### Rodar seed "sozinho"
Se você quiser testar apenas seed (sem reset), rode dentro do DB:

Via psql / UI do Supabase local:
- Cole o conteúdo do `supabase/seed.sql`

### Sintomas comuns
- `relation does not exist`: seed referenciando nome antigo
- `ON CONFLICT … no unique constraint`: seed dependente de constraint inexistente
- Enum inválido: seed usando valor legado

## Regras de ouro (pra não quebrar de novo)

1. Qualquer mudança de schema → migration nova + `db reset` antes do commit.
2. Seed precisa rodar N vezes sem duplicar (idempotente).
3. Quando mexer em view com tipo/precisão → preferir drop + recreate.
