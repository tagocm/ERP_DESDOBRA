# ADR-POC-ALLOCATIONS

Data: 24/02/2026

## Decisão

- Introduzimos `ar_installment_allocations` e `ap_installment_allocations` para representar rateio contábil N:N por parcela.
- `ar_installments.account_id` e `ap_installments.account_id` permanecem como legado/fallback.
- A UI de aprovação não exige seleção manual de conta; a classificação padrão é automática.

## Motivação

- Uma única parcela pode conter itens de múltiplas contas de resultado.
- Modelo 1:1 em `account_id` distorce DRE e exige intervenção manual.
- Pequenas indústrias precisam de automação com baixo atrito operacional.

## Regras implementadas

- Venda: `sales_document_items -> items.category_id -> product_categories.revenue_account_id`.
- Rateio persistido por parcela via RPC transacional (`set_*_installment_allocations`).
- Validação forte: soma dos allocations deve bater exatamente com `amount_original` da parcela.

## UI

- “Classificação automática” como padrão.
- Modal read-only “Ver rateio”.
- Edição manual de conta contábil removida nesta fase.

## Competência (base DRE)

- `allocations` por parcela serão a fonte para DRE por competência.
- TODO Fase DRE: introduzir/normalizar `competence_date` explícito para regras de reconhecimento.
