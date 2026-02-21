# Diagnóstico: Categoria de Produto Acabado x Plano de Contas

## Escopo analisado
- Modal de categorias: `/components/finance/chart-of-accounts/ManageCategoriesModal.tsx`
- Server actions: `/app/actions/finance-actions.ts`
- Regras de dados: `/lib/data/finance/chart-of-accounts.ts`
- Schema/seed: `/supabase/migrations/20260219150000_chart_of_accounts_schema.sql`

## Evidências objetivas do bug
1. O fluxo atual **não é transacional**.
- Em `createRevenueCategory` a conta é criada primeiro e depois a categoria.
- Em caso de falha da categoria, existe apenas rollback compensatório via delete da conta.
- Se falhar o update final de `origin_id`, pode sobrar inconsistência parcial.

2. A geração de código `1.1.xx` tem janela de corrida.
- A função atual `generate_next_revenue_code` usa `MAX(code)` sem lock transacional por empresa.
- Em concorrência, duas requisições podem calcular o mesmo próximo sufixo.

3. O vínculo 1:1 não está blindado por constraints completas.
- `product_categories.revenue_account_id` é nullable no schema atual.
- Não há unicidade parcial explícita por `(company_id, origin_id)` para `origin='PRODUCT_CATEGORY'`.

4. Uso da categoria para exclusão/inativação está incompleto.
- `usage_count` no modal está como placeholder `0`.
- Exclusão pode ocorrer sem considerar uso real em `items`/eventos financeiros.

## Impacto
- Categoria pode existir sem conta vinculada (ou vice-versa).
- Em concorrência, risco de colisão de código contábil.
- Exclusão/inativação pode violar regra de negócio.

## Direção da correção
- Mover criação categoria+conta para função SQL transacional com lock por empresa.
- Impor integridade de vínculo via índices/constraints.
- Garantir regras de uso/inativação no backend (não apenas UI).
- Manter escopo company (multi-tenant) de ponta a ponta.
