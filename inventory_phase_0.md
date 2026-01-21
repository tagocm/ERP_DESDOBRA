# INVENTÁRIO DO SISTEMA E MAPA DE LEGADO (Fase 0)

Este documento apresenta uma visão técnica completa do estado atual do sistema `erp-desdobra`. O objetivo é mapear estruturas existentes para subsidiar a implementação dos módulos de **Entregas** e **Financeiro no Pedido**.

---

## 1. Visão Geral do Sistema Atual

O sistema opera com um fluxo centralizado no **Pedido de Venda (`sales_documents`)**.
- A **Expedição** funciona baseada em status de pedido (`status_logistic`) e vínculo com rotas (`delivery_routes`).
- O **Financeiro** opera através de automações que disparam a criação de títulos (`ar_titles`) quando o pedido entra em rota.
- O **Estoque** é baixado automaticamente (`inventory_movements`) via triggers de banco de dados no momento da saída para rota.

---

## 2. Backend — Banco de Dados

### 2.1. Vendas / Pedidos
Tabela central querege comercial, fiscal e logística.

| Tabela / Coluna | Tipo | Uso / Descrição | Atualizado Por |
| :--- | :--- | :--- | :--- |
| **`sales_documents`** | Tabela | Cabeçalho do Pedido. | Frontend Vendas / API Rota |
| `id` | UUID | Identificador único. | Sistema |
| `status_logistic` | ENUM | Controla o fluxo físico: `pendente` -> `roteirizado` -> `em_rota` -> `entregue` / `devolvido`. | Trigger / API `start-route` |
| `status_commercial` | TEXT | Controle comercial (`draft`, `approved`, etc). | Frontend Vendas |
| `status_fiscal` | TEXT | Emissão de NFe (`authorized`, `none`). | Frontend Fiscal |
| `total_amount` | NUMERIC | Valor total usado para gerar finanças. | Trigger de Cálculo |
| `internal_notes` | TEXT | Log de ocorrências (ex: "Não Carregado"). | API `start-route` |
| **`sales_document_items`** | Tabela | Itens do pedido. | Frontend Vendas |
| `quantity` | NUMERIC | Quantidade vendida original. | Frontend Vendas |
| `qty_base` | NUMERIC | Quantidade base (m²) para estoque. | Trigger/Frontend |

### 2.2. Expedição / Logística
Gerenciamento de rotas e carregamento.

| Tabela / Coluna | Tipo | Uso / Descrição | Atualizado Por |
| :--- | :--- | :--- | :--- |
| **`delivery_routes`** | Tabela | Agrupador de pedidos (Caminhão/Data). | Logística |
| `logistics_status` | ENUM | Sincronizado com `sales_documents.status_logistic` via trigger. | API `start-route` |
| **`delivery_route_orders`** | Tabela | Link N:N (Rota <-> Pedido). "Staging" de carregamento. | Frontend Logística |
| `loading_status` | TEXT | Status de conferência de carga (`pending`, `loaded`, `partial`, `not_loaded`). | Frontend Checklist |
| `partial_payload` | JSONB | Armazena dados temporários de carregamento parcial ou ocorrência. | Frontend Modal |
| **`delivery_route_order_occurrences`** | Tabela | Histórico de ocorrências de carregamento e entrega (criada recentemente). | Frontend Modal |
| `occurrence_type` | TEXT | `NOT_LOADED_TOTAL`, `PARTIAL_LOADED`. | Modal Ocorrência |

### 2.3. Financeiro
Mecanismo atual de contas a receber.

| Tabela / Coluna | Tipo | Uso / Descrição | Atualizado Por |
| :--- | :--- | :--- | :--- |
| **`financial_postings`** | Tabela | Tabela de "pré-lançamentos" automáticos. | Trigger `logistics_change` |
| `amount_total` | NUMERIC | Snapshot do valor do pedido ao entrar em rota. | Trigger |
| **`ar_titles`** | Tabela | Títulos a Receber (Ledger Real). | Trigger Auto / Manual |
| **`ar_installments`** | Tabela | Parcelas do título. | Trigger (Payment Terms) |
| `amount_original` | NUMERIC | Valor da parcela calculado via Condição de Pagamento. | Trigger |

### 2.4. Estoque
| Tabela / Coluna | Tipo | Uso / Descrição | Atualizado Por |
| :--- | :--- | :--- | :--- |
| **`inventory_movements`** | Tabela | Livro razão de estoque. | Trigger `logistics_change_stock` |

---

## 3. Backend — Regras de Negócio Importantes

### 3.1. Triggers de Automação "Hard-Coded"
Existem regras críticas implementadas diretamente no banco de dados (PL/pgSQL) que podem conflitar com a nova lógica de Entregas.

1.  **`on_sales_logistic_update` -> `handle_sales_order_logistic_change_ar`**:
    -   **Gatilho**: Quando `status_logistic` muda para `em_rota`.
    -   **Ação**: Cria automaticamente `ar_titles` e `ar_installments` baseados na Condição de Pagamento (`payment_terms_id`).
    -   **Risco**: Se implementarmos entregas parciais reais, esse trigger lançará 100% do valor do pedido na primeira "saída", duplicando se houver segunda saída.

2.  **`on_sales_logistic_update` -> `handle_sales_order_logistic_change_stock`**:
    -   **Gatilho**: Quando `status_logistic` muda para `em_rota`.
    -   **Ação**: Baixa 100% dos itens do pedido no estoque.
    -   **Risco**: Incompatível com entregas parciais/múltiplas. Baixará tudo na primeira viagem.

3.  **`route_status_sync_trigger`**:
    -   Mantém Sincronia Rota <-> Pedido. Se a rota muda, todos os pedidos mudam. Isso impede que pedidos em uma mesma rota tenham status diferentes (ex: um entregue, outro devolvido) se a gestão for puramente pela rota.

### 3.2. API `start-route` (`app/api/expedition/start-route`)
-   Contém lógica de "Clonagem de Pedido" para casos de "Não Carregado".
-   Realiza a mudança em massa de status para `em_rota`.

---

## 4. Frontend — Telas e Fluxos

### 4.1. Vendas (`/app/vendas/pedidos`)
-   **Listagem e Edição de Pedidos**.
-   Visualiza status logístico e fiscal.
-   Permite cadastro de itens e definição de condição de pagamento.

### 4.2. Logística (`/app/logistica/rotas` -> `ExpedicaoClient`)
-   **ExpeditionPageClient / ExpedicaoClient**: Tela principal de gerenciamento.
-   **RouteDetails**: Lista pedidos da rota.
-   **LoadingChecklist**: Interface onde opera o usuário de expedição.
    -   Define `loading_status` (`loaded` / `not_loaded` / `partial`).
    -   Abre modais (`NotLoadedModal`, `PartialLoadModal`) que gravam em JSON (`partial_payload`).
    -   A ação "Iniciar Rota" processa esses JSONs.

---

## 5. LEGADO A SUBSTITUIR / DESATIVAR (⚠️ CRÍTICO)

Abaixo estão os componentes identificados como candidatos a remoção ou re-escrita profunda para suportar o novo modelo de Entregas e Financeiro vinculado.

### 5.1. Conceitos de "Logística no Pedido"
-   **Coluna `status_logistic` em `sales_documents`**:
    -   *Motivo*: No futuro, um pedido terá N Entregas. O status logístico do pedido será derivado (ex: "Parcialmente Entregue"), e não um ENUM simples que muda com a rota.
    -   *Substituição*: Tabela `deliveries` (Entregas).

### 5.2. "Staging" em `delivery_route_orders`
-   **Colunas `loading_status` e `partial_payload`**:
    -   *Motivo*: Hoje guardam "intenção de entrega" em JSON. O novo modelo deve criar objetos de Entrega reais.

### 5.3. Triggers Financeiros Automáticos (`handle_sales_order_logistic_change_ar`)
-   **Gatilho de `em_rota`**:
    -   *Motivo*: Gera financeiro baseado no valor total do pedido "cegamente".
    -   *Substituição*: Ledger Financeiro que gera títulos proporcionais à **Entrega** (Packing Slip) ou Faturamento, não à "saída para rota".

### 5.4. Triggers de Estoque Automáticos (`handle_sales_order_logistic_change_stock`)
-   **Baixa total em `em_rota`**:
    -   *Motivo*: Impede múltiplas baixas parciais.
    -   *Substituição*: Baixa de estoque baseada na confirmação da **Entrega** (ou Picking).

---

## 6. Riscos de Conflito Identificados

1.  **Duplicidade Financeira**: Se criarmos o novo Ledger Financeiro sem desativar o trigger `handle_sales_order_logistic_change_ar`, cada saída de rota vai gerar 2x contas a receber.
2.  **Estoque Negativo**: O trigger atual baixa tudo. Se o novo sistema baixar por entrega parcial, haverá baixa em duplicidade.
3.  **Travamento de Status**: O ENUM atual do pedido (`logistics_status`) é restritivo. Pedidos com mult-entregas quebrarão a lógica de visualização atual que espera um único status.
