# ADR: Rateio contábil por parcela (AR/AP)

Data: 24/02/2026

## Contexto

O modelo existente de classificação financeira no ERP estava em `account_id` 1:1 por parcela (`ar_installments` e `ap_installments`). Isso não cobre pedidos com itens de múltiplas categorias/contas contábeis, inviabilizando DRE consistente por competência.

## Decisão

1. Criar tabelas de rateio por parcela:
   - `ar_installment_allocations`
   - `ap_installment_allocations`
2. Manter `account_id` como campo legado de compatibilidade.
3. Gerar rateio automático no backend para AR originado de vendas:
   - `item -> categoria -> revenue_account_id`
   - agrupar por conta
   - distribuir proporcionalmente nas parcelas com ajuste de centavos.
4. UI de aprovação deixa de exigir dropdown de conta por padrão e passa a exibir “Classificação automática” com modal “Ver rateio” (somente leitura).
5. Backfill:
   - quando existe `account_id` legado, criar allocation única;
   - quando não existe base segura, registrar `NEEDS_REVIEW` em `installment_allocation_backfill_audit`.

## Consequências

- DRE por competência pode usar allocations por parcela como base analítica.
- Fluxo operacional reduz erro humano de classificação manual.
- Casos históricos incompletos ficam auditáveis para saneamento incremental.
