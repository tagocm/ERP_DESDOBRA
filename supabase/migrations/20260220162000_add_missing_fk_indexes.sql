-- add_missing_fk_indexes
-- Cria índices para FKs sem cobertura no schema public (lint 0001_unindexed_foreign_keys).
-- Estratégia: detectar FKs sem índice cobrindo o prefixo das colunas da FK e criar índice btree.
-- Idempotente: só cria quando não existir índice cobrindo a FK.

DO $$
DECLARE
  fk RECORD;
  cols_sql TEXT;
  idx_name TEXT;
BEGIN
  FOR fk IN
    WITH fk_constraints AS (
      SELECT
        c.oid AS constraint_oid,
        c.conname,
        c.conrelid,
        n.nspname AS schema_name,
        cls.relname AS table_name,
        c.conkey
      FROM pg_constraint c
      JOIN pg_class cls ON cls.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cls.relnamespace
      WHERE c.contype = 'f'
        AND n.nspname = 'public'
    )
    SELECT fk_constraints.*
    FROM fk_constraints
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = fk_constraints.conrelid
        AND i.indisvalid
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= cardinality(fk_constraints.conkey)
        AND NOT EXISTS (
          SELECT 1
          FROM generate_subscripts(fk_constraints.conkey, 1) s
          WHERE (i.indkey::smallint[])[s - 1] <> fk_constraints.conkey[s]
        )
    )
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
      INTO cols_sql
    FROM unnest(fk.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = fk.conrelid
     AND a.attnum = k.attnum;

    -- Nome estável <= 63 chars
    idx_name :=
      left('idx_' || fk.table_name || '_fk_' || replace(fk.conname, '"', ''), 52)
      || '_'
      || substr(md5(fk.conname || ':' || fk.table_name), 1, 10);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name,
      fk.schema_name,
      fk.table_name,
      cols_sql
    );
  END LOOP;
END
$$;
