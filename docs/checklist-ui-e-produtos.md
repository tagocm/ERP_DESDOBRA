# Checklist: UI Bible & Refatoração de Produtos

> Checklist detalhado para execução do projeto "UI Bible + Produtos Full".

## PARTE 1: Preparação & Standards (UI Bible)
- [x] Criar documento `/docs/ui-bible.md` com regras de interface. <!-- id: 0 -->
- [ ] Validar conformidade do **Sidebar** atual com a UI Bible (Logo, Menu, Footer). <!-- id: 1 -->
- [ ] Validar conformidade do **Top Header** atual (Altura, Alinhamento, Conteúdo). <!-- id: 2 -->
- [ ] Verificar se componentes globais (`PageHeader`, `Tabs`) estão seguindo a UI Bible. <!-- id: 3 -->

## PARTE 2: Banco de Dados (Produtos)
- [ ] Criar migração SQL para novas tabelas de perfil do item: <!-- id: 4 -->
    - [ ] `item_inventory_profiles` (Estoque: min, max, local, lote, validade) <!-- id: 5 -->
    - [ ] `item_purchase_profiles` (Compras: lead time, fornecedor pref) <!-- id: 6 -->
    - [ ] `item_sales_profiles` (Vendas: comissão, tabela preço) <!-- id: 7 -->
    - [ ] `item_fiscal_profiles` (Fiscal: NCM, CEST, Origem, CFOP, Grupo Tributário) <!-- id: 8 -->
    - [ ] `item_production_profiles` (PCP: é produzido?, BOM id) <!-- id: 9 -->
- [ ] Atualizar tabela `items` se necessário (campos core: GTIN, Marca, Imagem, Descrição). <!-- id: 10 -->
- [ ] Criar tabelas para Fiscal se não existirem (`tax_groups`, `tax_rules`). <!-- id: 11 -->
- [ ] Aplicar migração e gerar tipos TypeScript (`types/database.ts` ou similar). <!-- id: 12 -->

## PARTE 3: Interface de Produtos (Novo/Edição)
- [ ] **Navegação:**
    - [ ] Rota `/app/cadastros/produtos/novo` (Full Page). <!-- id: 13 -->
    - [ ] Rota `/app/cadastros/produtos/[id]` (Full Page). <!-- id: 14 -->
- [ ] **Componente de Formulário:**
    - [ ] PageHeader com ações Sticky (Salvar, Salvar e Novo). <!-- id: 15 -->
    - [ ] Estado local complexo (React Hook Form ou state manual) para gerenciar todas as abas. <!-- id: 16 -->
    - [ ] **Aba 1: Identificação** (Campos: Tipo, SKU, Nome, UOM, GTIN, Marca, Imagem). <!-- id: 17 -->
    - [ ] **Aba 2: Estoque** (Campos: Controla Estoque?, Min/Max, Local, Lote/Validade). <!-- id: 18 -->
    - [ ] **Aba 3: Compras** (Campos: Fornecedor, Lead time). <!-- id: 19 -->
    - [ ] **Aba 4: Vendas** (Campos: Vendável?, Tabela, Obs). <!-- id: 20 -->
    - [ ] **Aba 5: Fiscal** (Campos: NCM, CEST, Origem, tributação básica). <!-- id: 21 -->
    - [ ] **Aba 6: Produção** (Campos: Produzido?, Link BOM). <!-- id: 22 -->
- [ ] **Lógica de Salvamento:**
    - [ ] Validação por aba (mostrar erro na aba correspondente). <!-- id: 23 -->
    - [ ] Transação única (Supabase RPC ou múltiplos inserts sequenciais controlados). <!-- id: 24 -->

## PARTE 4: UX & Refinamentos
- [ ] Máscaras de entrada (NCM, EAN, Valores). <!-- id: 25 -->
- [ ] Feedback visual ao salvar (Toast sucess/erro). <!-- id: 26 -->
- [ ] Garantir que não existem botões duplicados no rodapé (padrão UI Bible). <!-- id: 27 -->
