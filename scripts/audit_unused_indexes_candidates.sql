-- Audit conservador de índices sem uso.
-- Objetivo: gerar candidatos de remoção com risco baixo.
-- Não remove nada automaticamente.
--
-- Regras:
-- 1) Somente schema public.
-- 2) idx_scan = 0.
-- 3) Exclui PK/UNIQUE/EXCLUSION e índices que suportam constraints.
-- 4) Exclui índices criados para cobrir FK (prefixo idx_%_fk_%).
-- 5) Exclui índices parciais e de expressão (normalmente intencionais).
--
-- Observação: se pg_stat_database.stats_reset for recente, aguarde janela de uso
-- real (ex.: 2-4 semanas) antes de remover candidatos.

WITH stats_reset AS (
  SELECT stats_reset
  FROM pg_stat_database
  WHERE datname = current_database()
),
idx AS (
  SELECT
    n.nspname AS schema_name,
    t.relname AS table_name,
    c.relname AS index_name,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_get_indexdef(i.indexrelid) AS index_def,
    i.indisprimary,
    i.indisunique,
    i.indisexclusion,
    i.indpred IS NOT NULL AS is_partial,
    i.indexprs IS NOT NULL AS is_expression,
    EXISTS (
      SELECT 1
      FROM pg_constraint k
      WHERE k.conindid = i.indexrelid
    ) AS supports_constraint
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_stat_user_indexes s ON s.indexrelid = i.indexrelid
  WHERE n.nspname = 'public'
)
SELECT
  idx.schema_name,
  idx.table_name,
  idx.index_name,
  idx.idx_scan,
  idx.idx_tup_read,
  idx.idx_tup_fetch,
  (SELECT stats_reset FROM stats_reset) AS stats_reset,
  format('DROP INDEX CONCURRENTLY IF EXISTS %I.%I;', idx.schema_name, idx.index_name) AS suggested_drop_sql
FROM idx
WHERE idx.idx_scan = 0
  AND idx.indisprimary = false
  AND idx.indisunique = false
  AND idx.indisexclusion = false
  AND idx.supports_constraint = false
  AND idx.is_partial = false
  AND idx.is_expression = false
  AND idx.index_name !~ '^idx_.*_fk_.*'
ORDER BY idx.table_name, idx.index_name;
