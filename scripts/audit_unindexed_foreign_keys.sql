-- Audit: lista FKs sem índice cobrindo o prefixo das colunas da FK

WITH fk_constraints AS (
  SELECT
    c.conname,
    n.nspname AS schema_name,
    cls.relname AS table_name,
    c.conrelid,
    c.conkey,
    pg_get_constraintdef(c.oid) AS constraint_def
  FROM pg_constraint c
  JOIN pg_class cls ON cls.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
)
SELECT
  schema_name,
  table_name,
  conname,
  constraint_def
FROM fk_constraints fk
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_index i
  WHERE i.indrelid = fk.conrelid
    AND i.indisvalid
    AND i.indpred IS NULL
    AND i.indexprs IS NULL
    AND i.indnkeyatts >= cardinality(fk.conkey)
    AND NOT EXISTS (
      SELECT 1
      FROM generate_subscripts(fk.conkey, 1) s
      WHERE (i.indkey::smallint[])[s - 1] <> fk.conkey[s]
    )
)
ORDER BY table_name, conname;
