# Regra de Negócio: Categoria de Produto Acabado x Plano de Contas

## Objetivo
Toda categoria criada no modal de **Categorias de Produto (Acabado)** deve gerar automaticamente uma conta analítica filha de `1.1 Receita Bruta de Vendas`.

## Regras
1. Escopo é por empresa (`company_id`).
2. Criação é atômica (transação):
- cria conta `1.1.xx` (`ANALITICA`, `RECEITA`, `origin=PRODUCT_CATEGORY`)
- cria categoria com `revenue_account_id`
- grava retorno da referência cruzada (`origin_id` na conta)
3. Código `1.1.xx` é monotônico por empresa (não reutiliza números) usando lock transacional + estado em `revenue_category_sequences`.
4. Exclusão:
- se houver uso (produtos vinculados ou títulos financeiros vinculados à conta), exclusão é bloqueada
- nesses casos, usar inativação
5. Inativação da categoria inativa também a conta vinculada.
6. Produto não pode vincular categoria inativa (trigger no banco).

## Garantias de Integridade
- `product_categories` (tenant) exige `revenue_account_id`.
- unicidade de vínculo categoria→conta por empresa.
- unicidade de vínculo conta PRODUCT_CATEGORY→categoria por empresa.

## Observação de operação
A estrutura base (`1`, `1.1`, etc.) vem de `seed_chart_spine(company_id)`.
Se a empresa ainda não tiver espinha, ela é inicializada antes da criação da categoria.
