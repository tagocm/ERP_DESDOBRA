# Diagnóstico Técnico: Estrutura Atual do Backend

Este diagnóstico descreve fielmente a estrutura de banco de dados e tipos TypeScript existentes no projeto até 31/12/2025.

---

## 1) Cadastros

### Produtos (`items`)
- **Código:** `types/supabase.ts`, `types/product.ts`
- **Tipo:** DB Table `public.items`
- **Campos:**
  - `id`: uuid | PK | Obrigatório
  - `company_id`: uuid | FK | Obrigatório
  - `name`: text | Obrigatório
  - `sku`: text | Default null
  - `type`: text | Obrigatório (ex: 'product', 'service')
  - `uom`: text | Obrigatório (Legado, uso híbrido com tabela UOMs)
  - `is_active`: boolean | Default true
  - `avg_cost`: numeric | Default 0
  - `gtin`: text | Nullable (Nota: Instruções de renomeação para `gtin_ean_base` em andamento)
  - `brand`, `line`, `description`, `image_url`: text | Nullable
  - `deleted_at`: timestamptz | Soft Delete
- **Relacionamentos:**
  - `company_id` -> `companies` (N:1)
  - `pk` <-> `item_xxxx_profiles` (1:1) para Estoque, Vendas, Fiscal, Produção, Compras.

### Embalagens (`item_packaging`)
- **Código:** `types/product.ts` (Type), Migração `20251226180000`
- **Tipo:** DB Table `public.item_packaging`
- **Campos:**
  - `id`: uuid | PK
  - `item_id`: uuid | FK | Obrigatório
  - `type`: text (enum: 'BOX', 'PACK', 'BALE', 'PALLET', 'OTHER')
  - `label`: text | Obrigatório
  - `qty_in_base`: number | Obrigatório
  - `gtin_ean`: text | Nullable
  - `net_weight_g`, `gross_weight_g`: numeric | Nullable
  - `is_default_sales_unit`: boolean | Default false
- **Relacionamentos:**
  - `item_id` -> `items` (N:1)

### Unidades de Medida (`uoms`)
- **Código:** `types/product.ts`, Migração `20251227181500`
- **Tipo:** DB Table `public.uoms`
- **Campos:** `id`, `name`, `abbrev`, `is_active`.

### Clientes / Empresas (`organizations`)
- **Código:** `types/supabase.ts`, `migrations/20251221230249`
- **Tipo:** DB Table `public.organizations`
- **Campos:**
  - `id`: uuid | PK
  - `trade_name`: text | Obrigatório
  - `legal_name`: text | Nullable
  - `document`: text (CPF/CNPJ) | Unique (com filtro de company)
  - `status`: text ('active', 'inactive') | Default 'active'
  - `price_table_id`: uuid | FK | Nullable
  - `deleted_at`: timestamptz
- **Relacionamentos:**
  - `company_id` -> `companies` (N:1)
  - `price_table_id` -> `price_tables` (N:1)
  - `people` -> Contatos (1:N)
  - `addresses` -> Endereços (1:N)

### Tabelas de Preço (`price_tables`)
- **Código:** `migrations/20251223000000`
- **Tipo:** DB Table `public.price_tables`
- **Campos:**
  - `name`: text
  - `effective_date`, `valid_from`, `valid_to`: date
  - `min_order_value`: numeric
  - `states`: text[] (Array de UFs)
  - `customer_profiles`: text[] (Tags)
- **Relacionamentos:**
  - `items` -> `price_table_items` (1:N) com campo `price`

### Rotas / Expedição (`delivery_routes`)
- **Código:** `migrations/20251224210000`
- **Tipo:** DB Table `public.delivery_routes`
- **Campos:**
  - `name`: text
  - `route_date`: date
  - `scheduled_date`: date | Nullable (Se null = Rota Rascunho/Não Agendada)
  - `status`: text ('planned', 'closed', 'in_transit', 'done', 'cancelada')
- **Relacionamentos:**
  - `orders` -> `delivery_route_orders` (1:N) (Tabela de Junção com Pedidos)

### Preferências (`system_preferences`)
- **Código:** `migrations/20251231020000`, `types/system-preferences.ts`
- **Tipo:** Conjunto de Tabelas
- **Estrutura:**
  - `system_occurrence_types`: Tipos fixos (Expedição, Retorno...)
  - `system_occurrence_reasons`: Motivos cadastro (Cliente ausente, Avaria...)
  - `system_occurrence_reason_defaults`: Configuração de ações booleanas (gerar devolução, voltar p/ pendente...)

---

## 2) Pedidos

### Pedido (`sales_documents`)
- **Código:** `migrations/20251223220000`, `types/sales.ts`
- **Tipo:** DB Table `public.sales_documents`
- **Campos Principais:**
  - `id`: uuid | PK
  - `document_number`: bigint | Identity
  - `doc_type`: text ('proposal', 'order')
  - `client_id`: uuid | FK
  - `status_commercial`: text ('draft', 'sent', 'approved', 'confirmed', 'cancelled')
  - `status_logistic`: text ('pending', 'separation', 'expedition', 'delivered')
  - `status_fiscal`: text ('none', 'authorized', 'error')
  - `total_amount`, `freight_amount`: numeric
  - `delivery_address_json`: jsonb
  - `deleted_at`: timestamptz
- **Relacionamentos:**
  - `client_id` -> `organizations`
  - `carrier_id` -> `organizations`
  - `items` -> `sales_document_items` (1:N)
  - `payments` -> `sales_document_payments` (1:N)
  - `history` -> `sales_document_history` (1:N)
  - `logs` -> `order_occurrence_logs` (1:N) (via Logística)

### Itens do Pedido (`sales_document_items`)
- **Tipo:** DB Table `public.sales_document_items`
- **Campos:**
  - `item_id`: uuid | FK
  - `quantity`: numeric
  - `unit_price`: numeric
  - `discount_amount`: numeric
  - `total_amount`: numeric (Stored Column)
  - `notes`: text
  - **Fiscais:** `cfop_code`, `cst_icms`, `pis_...`, `cofins_...` (Adicionados recentemente)

---

## Fluxo & Regras

1.  **Status do Pedido:** Controlado por três colunas independentes (`commercial`, `logistic`, `fiscal`).
2.  **Logística:**
    -   Pedido nasce `pending`.
    -   Ao entrar numa rota (`delivery_route_orders`), pode assumir status de separação/carregamento.
    -   Ocorrências de entrega (Parcial/Não Entregue) geram logs em `order_occurrence_logs` e disparam ações baseadas em `system_occurrence_reason_defaults`.
3.  **Auditoria:**
    -   `sales_document_history`: Rastreia alterações gerais no pedido.
    -   `route_event_logs`: Rastreia eventos da rota (início, fim, paradas).
4.  **Soft Delete:** Implementado globalmente via coluna `deleted_at` (Organizações, Itens, Pedidos).

---

## Observações Finais
- **Ocorrências:** A lógica de retorno e não-entrega é "data-driven" baseada na tabela de preferências do sistema.
- **Campos Fiscais:** Estão denormalizados nos itens do pedido para snapshot histórico.
- **Peso:** Presente no cabeçalho do pedido (`total_weight_kg`) via migração recente.
