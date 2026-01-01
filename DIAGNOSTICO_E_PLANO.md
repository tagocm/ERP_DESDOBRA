# Diagnóstico e Mapa da Estrutura Atual

## A) O que existe no Banco de Dados (Backend)

### 1. Cadastros
*   **Produtos (`items`)**:
    *   Campos confirmados: `id`, `name`, `sku`, `company_id`, `uom` (string simples).
    *   **Novos campos (Peso)**: `base_weight_kg` (adicionado na migração `20251230150000`).
*   **Embalagens (`item_packaging`)**:
    *   Tabela existe (`20251226180000_product_packaging.sql`).
    *   Campos: `id`, `item_id`, `type`, `label`, `qty_in_base`, `gtin_ean`, `net_weight_g`.
    *   **Status**: Existe no banco, mas não é populada/usada na criação do pedido atual.
*   **Unidades (`uoms`)**:
    *   Tabela existe. Uso no `items` ainda é híbrido (coluna `uom` texto simples + tabela `uoms` desacoplada).

### 2. Pedidos (`sales_documents`)
*   **Campos confirmados**:
    *   `freight_amount`: Numeric (existe).
    *   `carrier_id`: UUID (existe).
    *   `delivery_address_json`: JSONB (existe).
    *   `total_weight_kg`: Numeric (adicionado na migração `20251230150000_add_weight_fields.sql`).
    *   **Cálculo Automático**: Existe uma trigger `trg_update_sales_order_weight` no banco que recalcula o `total_weight_kg` após mudanças nos itens.

*   **Itens do Pedido (`sales_document_items`)**:
    *   `quantity`: Quantidade principal.
    *   `qty_base`: Campo adicionado (`20251230150000`) para armazenar a qtd na unidade base, mas a UI ainda não grava nele diferentemente da `quantity`.
    *   **Embalagem**: Não existe coluna de `packaging_id` ou `packaging_type` nesta tabela.

### 3. Logística (Carregamento Parcial)
*   **Registro**:
    *   Não altera a quantidade original do item em `sales_document_items` (o pedido comercial fica intacto).
    *   **Onde grava**: Na tabela de junção `delivery_route_orders`.
        *   Campos: `loading_status` ('partial') e `partial_payload` (JSON com o que foi carregado/restante).
        *   Logs: `system_occurrence` registra o evento visível no histórico.
*   **Fluxo**: Não cria pedido complementar automaticamente no nível de banco *ainda* (depende da ação do usuário no modal de ocorrência que dispara flags, mas o registro primário é o status na rota).

---

## B) O que existe na UI Hoje

### 1. Lista de Pedidos
*   Colunas visíveis: Número, Cliente, Data, Status (Comercial, Logístico, Fiscal), Total.
*   **Ausente**: Coluna de Peso Total (Total Weight) e Transportadora.

### 2. Tela de Pedido (`SalesOrderForm.tsx`)
*   **Geral**:
    *   Seleção de Cliente, Tabela de Preço, Condição Pagamento.
    *   Campos de totais (Subtotal, Desconto, Frete, Total).
*   **Itens (`TabItems`)**:
    *   Grid simples: Produto, Qtd, Preço, Desconto, Total.
    *   **Ausente**: Seleção de Embalagem (Caixa/Unidade). O sistema assume venda na unidade padrão do produto.
    *   **Ausente**: Visualizador de peso por item ou peso total somado em tempo real (interface não mostra o `total_weight_kg` calculado pelo banco).
*   **Entrega (`TabDelivery`)**:
    *   Endereço (JSON), Transportadora (campo existe no form).
    *   **Ausente**: Configuração avançada de frete (CIF/FOB explícito, volumes).
*   **Rodapé/Ações**:
    *   Botões: Salvar Rascunho, Confirmar.
    *   Opções Extras ("Mais"): Excluir Rascunho (Soft Delete) já está implementado logicamente (`deleteDraftOpen` state).

---

## C) O que está faltando (Gaps)

1.  **Venda por Embalagem**:
    *   UI para selecionar "Caixa com 12" vs "Unidade Avulsa" no grid de itens.
    *   Backend para salvar qual embalagem foi usada (hoje salva apenas qtd flat).
2.  **Visibilidade de Peso**:
    *   Mostrar Peso Líquido/Bruto total na tela de pedido (header ou footer).
    *   Mostrar Peso na Lista de Pedidos.
    *   Input manual de Peso (override) se necessário.
3.  **Refinamento de Frete**:
    *   Campo explícito para Tipo de Frete (CIF/FOB) além do valor.
    *   Cálculo de Volumes (hoje existe campo `volumes` na `delivery_route_orders`, mas não no cabeçalho do pedido comercial `sales_documents` para pré-cálculo).
4.  **Exclusão de Rascunho**:
    *   A lógica existe, mas precisa garantir que esteja acessível e clara para o usuário (botão "Excluir" visível para status `draft`).

---

## D) Plano de Ação Sugerido (4 PRs)

### PR 1: Visibilidade de Peso e Frete (Low Risk)
*   **Backend**: Nenhum change (campos já existem).
*   **Frontend**:
    *   Adicionar indicador de `Total Weight (kg)` no cabeçalho do `SalesOrderForm` (leitura do campo `total_weight_kg` + cálculo otimista local).
    *   Adicionar coluna "Peso" na `SalesOrderList`.
    *   Garantir que alteração de itens atualize o peso visualmente em tempo real.

### PR 2: Gestão de Embalagens na Venda (Medium Risk)
*   **Backend**: Adicionar coluna `packaging_id` (uuid nullable) em `sales_document_items`.
*   **Frontend**:
    *   Alterar `SalesOrderForm` > `TabItems`.
    *   Adicionar Dropdown de Unidade/Embalagem na linha do item (populado via `item_packaging`).
    *   Lógica: Se selecionar Caixa de 10, e digitar Qtd 2 -> Salvar Qtd=2, Qty_Base=20.

### PR 3: Refinamento de Dados de Entrega (Low Risk)
*   **Backend**: Adicionar `freight_type` ('CIF', 'FOB', 'Sem Frete') e `volumes_qty` em `sales_documents`.
*   **Frontend**:
    *   Atualizar `TabDelivery` para incluir esses seletores.
    *   Vincular `volumes_qty` a uma sugestão automática baseada nas embalagens do PR 2.

### PR 4: UX de Exclusão e Limpeza (Polimento)
*   **Frontend**:
    *   Expor botão "Excluir Pedido" de forma evidente quando status for `draft` (hoje está escondido ou em menu).
    *   Feedback visual melhor ao excluir (toast + redirect imediato).
