# Fix RLS `0006_multiple_permissive_policies`

## Escopo
- Migração: `supabase/migrations/20260220143000_fix_rls_multiple_permissive_policies.sql`
- Auditoria SQL: `scripts/rls/audit_multiple_permissive_policies.sql`

## Inventário (consulta usada)
```sql
WITH pol AS (
  SELECT schemaname, tablename, cmd, unnest(roles) AS role_name, permissive, policyname
  FROM pg_policies
  WHERE schemaname='public'
)
SELECT schemaname, tablename, cmd, role_name, count(*) AS permissive_count,
       array_agg(policyname ORDER BY policyname) AS policies
FROM pol
WHERE permissive = 'PERMISSIVE'
GROUP BY schemaname, tablename, cmd, role_name
HAVING count(*) > 1
ORDER BY tablename, cmd, role_name;
```

## Como validar localmente
1. Aplicar migrations:
```bash
npx supabase db reset
```

2. Rodar auditoria de duplicidade permissive:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/rls/audit_multiple_permissive_policies.sql
```

3. Resultado esperado:
- Sem linhas para as tabelas tratadas na migração.

## Checklist de teste manual
- [ ] Login com usuário membro de uma empresa ativa.
- [ ] Confirmar que listagens continuam isoladas por empresa (`company_id`/relacionamento tenant).
- [ ] `sales_documents`: SELECT/INSERT/UPDATE/DELETE apenas no tenant do usuário.
- [ ] `sales_document_items`: CRUD apenas para documentos do tenant.
- [ ] `price_table_items`: CRUD apenas para tabelas de preço do tenant.
- [ ] `fiscal_operations`: CRUD apenas no tenant.
- [ ] `ar_titles`: CRUD apenas no tenant.
- [ ] `ar_installments`: CRUD apenas quando `ar_title` pertence ao tenant.
- [ ] `organizations`: não deve haver leitura global (`USING true` removido).
- [ ] `company_bank_accounts`: leitura por perfis permitidos e escrita restrita a `owner/admin/finance`.
- [ ] Rodar Supabase Database Linter e confirmar ausência de `0006_multiple_permissive_policies` nas tabelas do escopo.
