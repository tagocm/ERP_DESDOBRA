# Auditoria — Plano de Contas (PoC) e Base DRE

Data: 24/02/2026  
Escopo: ERP Desdobra (financeiro AR/AP, vendas/pedidos, devoluções, baixas e recorrência)

## 1) Método de auditoria

- **Schema Postgres/Supabase**: inspeção via `psql` (`\d+`, `information_schema`, `pg_type`, `information_schema.triggers`).
- **Código**: varredura por termos (`gl_accounts`, `revenue_account_id`, `expense_account_id`, `classification`, `ar_titles`, `ap_titles`, `installments`, `refund`, `devolucao`, `reversal`).
- **Fluxos de UI**: revisão dos componentes de aprovação financeira e edição de parcelas.

---

## 2) Estado atual (schema e entidades)

## 2.1 Entidades principais encontradas

### Comercial/Vendas
- `public.sales_documents`
- `public.sales_document_items`
- `public.sales_document_payments`

### Financeiro (pré-evento e títulos)
- `public.financial_events`
- `public.financial_event_installments`
- `public.financial_event_allocations` (**não é rateio contábil por conta**)
- `public.ar_titles`, `public.ar_installments`
- `public.ap_titles`, `public.ap_installments`
- `public.ar_payments`, `public.ar_payment_allocations`
- `public.ap_payments`, `public.ap_payment_allocations`
- `public.financial_settlements`, `public.title_settlements`

### Plano de contas / cadastro contábil
- `public.gl_accounts`
- `public.product_categories` (`revenue_account_id`)
- `public.financial_categories` (`expense_account_id`)
- `public.cost_centers`

### Outros fluxos relacionados
- `public.recurring_rules`
- `public.sales_document_adjustments`
- `public.nfe_inbound_reversals`

## 2.2 Vínculos contábeis existentes (já implementados)

- `product_categories.revenue_account_id -> gl_accounts.id` (FK + check para tenant exigir conta de receita).
- `financial_categories.expense_account_id -> gl_accounts.id` (FK + check de categoria ativa exigir conta).
- `ar_installments.account_id -> gl_accounts.id`.
- `ap_installments.account_id -> gl_accounts.id`.
- `financial_event_installments.suggested_account_id` existe, mas sem FK para `gl_accounts` atualmente.

## 2.3 Diagrama textual (AS-IS)

```text
sales_documents (1) ──< sales_document_items >── (1) items ──> product_categories ──> gl_accounts (receita)
      │
      └──< sales_document_payments

sales_documents ──(trigger)──> financial_events (origin_type=SALE, direction=AR)
financial_events (1) ──< financial_event_installments (suggested_account_id, category_id)
financial_events (1) ──< financial_event_allocations >── ar_titles   [compensação evento->título]

financial_events (approved) ──> ar_titles/ap_titles
ar_titles (1) ──< ar_installments (account_id, cost_center_id)
ap_titles (1) ──< ap_installments (account_id, cost_center_id)

financial_categories ──> gl_accounts (despesa)
recurring_rules.category_id ──> financial_categories
```

---

## 3) Código e fluxos auditados

## 3.1 Backend/serviços que geram títulos AR/AP

- `app/actions/finance-events.ts`
  - Aprovação chama `generateTitleFromEvent`.
- `lib/finance/title-generator.ts`
  - `generateARTitle` e `generateAPTitle` criam parcelas em `ar_installments`/`ap_installments`.
  - Modelo atual: **uma conta por parcela** (`account_id <- suggested_account_id`).

## 3.2 Triggers/funções SQL críticas

- Trigger em `sales_documents`: `handle_sales_event_trigger`.
  - Cria `financial_events` + `financial_event_installments` no fluxo de confirmação comercial.
- Trigger em `sales_documents`: `handle_sales_order_logistic_change_ar`.
  - Também pode criar `ar_titles` + `ar_installments` ao mudar logística para `in_route`.

## 3.3 UI com seleção manual de classificação

- `components/finance/EventInstallmentsTable.tsx`
  - Possui dropdown de “Plano de Contas (Todos)” e por parcela (`suggested_account_id`).
- `components/finance/InstallmentDetailPanel.tsx`
  - Permite edição manual de conta por parcela.
- `components/finance/InstallmentsEditor.tsx`
  - Mantém campo de conta manual por parcela.

---

## 4) Problemas encontrados (com severidade)

## [P0] Modelo 1:1 de conta por parcela não atende venda com múltiplas categorias

- Evidência: `ar_installments.account_id` e `ap_installments.account_id` como vínculo único.
- Impacto: 1 parcela não consegue refletir N contas contábeis (ex.: itens de receitas diferentes no mesmo título).
- Risco: DRE distorcida por agregação indevida em conta única.

## [P0] Rateio contábil por título/parcela não existe

- Não existem tabelas `*_installment_allocations` para split por `gl_account_id`.
- `financial_event_allocations` atual não resolve isso (mapeia evento para título AR, não conta contábil).

## [P0] Dupla fonte de geração de AR (inconsistência potencial)

- Caminho A: `financial_events -> approve -> generateARTitle`.
- Caminho B: trigger `handle_sales_order_logistic_change_ar` direto em `ar_titles/ar_installments`.
- Impacto: risco de divergência de regras de classificação/rateio e comportamento não determinístico.

## [P1] Dependência de UI para classificação manual

- Fluxo de aprovação financeira ainda expõe seleção manual de conta por parcela.
- Impacto: baixa automação e risco operacional para pequenas indústrias.

## [P1] Ausência de validação forte de integridade contábil por parcela

- Não há garantia de que soma de rateios por parcela = valor da parcela (pois rateio ainda não existe).
- No estado atual, parcela pode ficar sem `account_id` ou com classificação incorreta.

## [P1] Recorrência sem integração explícita de geração contábil automática auditável

- `recurring_rules` existe com `category_id`, porém não foi identificado job/serviço dedicado de geração periódica consistente para eventos/títulos com classificação garantida.
- Impacto: gap para despesa por competência em escala.

## [P2] Mistura de modelos legados e novos no financeiro

- Há estruturas antigas (`financial_entries`) coexistindo com eventos/títulos.
- Impacto: aumenta custo de manutenção e risco de leitura analítica inconsistente.

---

## 5) Gaps para DRE por competência

## 5.1 O que já existe e pode ser aproveitado

- Datas e valores em títulos/parcelas (`date_issued`, `due_date`, `amount_*`).
- Vínculo de conta por categoria (receita/despesa) em cadastros.

## 5.2 O que falta

- Base transacional única por **rateio contábil de parcela** para AR/AP.
- Campo de competência explícito por parcela/rateio (ou regra de derivação formalizada).
- Regra formal de reconhecimento por origem (`SALE`, `PURCHASE`, `EXPENSE`, `RETURN`).

## 5.3 Regra recomendada (próximo passo)

- **DRE por competência** deve considerar `allocations` de títulos/parcelas por competência (`issued_at`/`competence_date`).
- **Baixa/recebimento** (`payments/settlements`) deve alimentar fluxo de caixa, não receita/despesa de competência.

---

## 6) Gaps para devolução/reversão

- Há infraestrutura fiscal de reversão (`nfe_inbound_reversals` e emissão de NF-e de entrada).
- Não há evidência de mecanismo contábil padronizado de **reversão proporcional de rateio** em AR/AP com referência explícita ao rateio original da venda.
- Risco: devolução impactar valor financeiro sem refletir reversão contábil por conta de origem.

---

## 7) Risco de órfãos / inconsistências

- Sem entidade de rateio, qualquer necessidade de multi-conta tende a virar ajuste manual ad-hoc.
- Fluxo duplo de criação de AR pode gerar parcelas sem padrão único de classificação.
- Backfill histórico exigirá trilha de revisão para casos sem conta legada confiável.

---

## 8) O que manter vs. o que mudar

## Manter
- `gl_accounts` e amarrações por categoria (`revenue_account_id` e `expense_account_id`).
- Fluxo `financial_events -> aprovação -> geração de títulos` como trilha principal.

## Mudar (mínimo necessário)
1. Introduzir entidade de **rateio por parcela** para AR/AP (`*_installment_allocations`).
2. Tornar a geração de rateio automática no backend para AR de vendas (produto->categoria->conta receita).
3. Tratar `ar_installments.account_id` e `ap_installments.account_id` como **legado de compatibilidade**.
4. Remover padrão de seleção manual de conta na UI de aprovação (manter visualização de rateio).
5. Backfill histórico com criação de allocation única quando possível e log de `NEEDS_REVIEW` quando não houver base segura.

---

## 9) BLOCKERS para fechar PoC

## BLOCKER-01
**Dupla estratégia de geração AR** (`handle_sales_order_logistic_change_ar` vs `generateARTitle`).  
Proposta: consolidar regra contábil no fluxo de aprovação e manter trigger logístico apenas para status operacional (ou alinhar trigger para também chamar a mesma rotina de rateio).

## BLOCKER-02
**Ausência de entidade de rateio por parcela em AR/AP.**  
Proposta: criar tabelas de allocation e adaptar geração/backfill.

---

## 10) Arquivos/funções auditados (amostra direta)

- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/lib/finance/title-generator.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/lib/finance/events-db.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/app/actions/finance-events.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/components/finance/EventInstallmentsTable.tsx`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/components/finance/InstallmentDetailPanel.tsx`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/components/finance/InstallmentsEditor.tsx`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/app/api/sales/approve-batch/route.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/lib/purchases/purchases-db.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/app/actions/financial/reject-sales.ts`
- `/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/app/actions/financial/reject-purchase.ts`

---

## 11) Plano de implementação (sequência aprovada)

1. `feat(db)`: tabelas `ar_installment_allocations` e `ap_installment_allocations` + FKs + índices + checks.
2. `feat(domain)`: tipos/repositórios tipados para allocations e validações sem `any`.
3. `feat(flow)`: geração automática de allocations no AR de vendas por categoria/conta com distribuição proporcional por parcela.
4. `feat(ui)`: “Classificação automática” por padrão + modal read-only “Ver rateio”.
5. `chore(backfill)`: criar allocations históricas (1:1 quando seguro) + registrar `NEEDS_REVIEW` em tabela de auditoria.
6. `docs+tests`: testes de distribuição/rateio e documentação de decisão para base DRE.

