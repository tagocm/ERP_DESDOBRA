# Implementação: Ajustes na Aba "Entrega & Frete"

## Data: 2025-12-31

## OBJETIVO COMPLETO

Ajustar a aba "Entrega & Frete" do Pedido para:
- ✅ Transportadora puxar default do cliente com dropdown pesquisável filtrado por "é transportadora"
- ✅ Data de entrega/previsão controlada pela Rota (não manual)
- ✅ Peso Bruto (NF-e) automático do cadastro do produto

---

## PARTE A — TRANSPORTADORA (dropdown pesquisável + defaults)

### Backend
**Arquivo:** `lib/clients-db.ts`
- ✅ Adicionada função `getCarriers()` que:
  - Busca organizações com role 'carrier' na tabela `organization_roles`
  - Filtra por company_id e status ativo
  - Suporta busca por nome/documento
  - Retorna dados formatados com endereço

### Frontend
**Arquivo:** `components/app/CarrierSelector.tsx` (NOVO)
- ✅ Componente True Gold com Select pesquisável
- ✅ Carrega transportadoras automaticamente
- ✅ Formata label: "Nome (Documento) - Cidade/UF"
- ✅ Estados de loading e empty
- ✅ Suporta disabled state

**Arquivo:** `components/sales/TabDelivery.tsx`
- ✅ Substituído `OrganizationSelector` por `CarrierSelector`
- ✅ Mantém regras de desabilitar por tipo de frete (RETIRA, ENTREGA PRÓPRIA)

**Arquivo:** `components/sales/order/SalesOrderForm.tsx`
- ✅ Lógica já existente para aplicar `preferred_carrier_id` do cliente (linha 385)
- ✅ Dialog de confirmação quando cliente muda e há dados de frete existentes

---

## PARTE B — DATA DE ENTREGA CONTROLADA POR ROTA

### Schema
**Arquivo:** `supabase/migrations/20252001000000_delivery_and_weight_enhancements.sql`
- ✅ Adicionado `scheduled_delivery_date` (DATE) - definido ao roteirizar
- ✅ Adicionado `delivered_at` (TIMESTAMPTZ) - confirmado no retorno
- ✅ Comentários explicativos

### Types
**Arquivo:** `types/sales.ts`
- ✅ Adicionados campos ao interface `SalesOrder`:
  - `scheduled_delivery_date?: string | null`
  - `delivered_at?: string | null`

### Frontend
**Arquivo:** `components/sales/TabDelivery.tsx`
- ✅ Campo "Previsão de Entrega" agora é READ-ONLY
- ✅ Mostra data formatada em pt-BR
- ✅ Placeholder: "Definido pela rota"
- ✅ Helper text quando não roteirizado: "Roteirize o pedido para definir a previsão"
- ✅ Ícone de check verde quando entregue
- ✅ Mostra "Entregue em DD/MM/AAAA HH:mm" quando `delivered_at` existe

### Integração com Roteirização (PENDENTE - próximo passo)
- ⏳ Ao adicionar pedido à rota: atualizar `scheduled_delivery_date` com `route.route_date`
- ⏳ No Retorno, ao confirmar "Entregue": gravar `delivered_at = NOW()`

---

## PARTE C — PESO BRUTO AUTOMÁTICO

### Schema
**Arquivo:** `supabase/migrations/20252001000000_delivery_and_weight_enhancements.sql`
- ✅ Adicionado `total_gross_weight_kg` (NUMERIC(10,3))
- ✅ Atualizado trigger `update_sales_document_weights()`:
  - Calcula peso líquido (existente)
  - Calcula peso bruto somando `items.gross_weight_g_base / 1000 * quantity`
  - Fallback: se produto não tem peso bruto, usa `peso_líquido * 1.1` (10% embalagem)

### Types
**Arquivo:** `types/sales.ts`
- ✅ Adicionado `total_gross_weight_kg?: number` ao `SalesOrder`

### Frontend
**Arquivo:** `components/sales/TabDelivery.tsx`
- ✅ Peso Líquido: READ-ONLY, mostra `total_weight_kg`
- ✅ Peso Bruto: READ-ONLY, mostra `total_gross_weight_kg`
- ✅ Helper text: "Calculado automaticamente"
- ✅ Campos desabilitados com bg-gray-50

---

## PRÓXIMOS PASSOS (INTEGRAÇÃO)

### 1. Roteirização
**Arquivo a modificar:** `app/app/logistica/expedicao/page.tsx` (ou similar)
- Ao adicionar pedido à rota:
```typescript
await supabase
  .from('sales_documents')
  .update({ 
    scheduled_delivery_date: route.route_date,
    status_logistic: 'roteirizado'
  })
  .eq('id', orderId);
```

### 2. Retorno (Confirmação de Entrega)
**Arquivo a modificar:** `app/app/logistica/retorno/page.tsx`
- Ao confirmar "Entregue":
```typescript
await supabase
  .from('sales_documents')
  .update({ 
    delivered_at: new Date().toISOString(),
    status_logistic: 'entregue'
  })
  .eq('id', orderId);
```

### 3. Aplicar Migration
```bash
# Executar no Supabase
psql -h <host> -U <user> -d <database> -f supabase/migrations/20252001000000_delivery_and_weight_enhancements.sql
```

---

## TESTES MANUAIS

### ✅ Teste 1: Cliente com Transportadora Preferencial
1. Cadastrar cliente com `preferred_carrier_id` preenchido
2. Criar novo pedido e selecionar esse cliente
3. Verificar que transportadora é preenchida automaticamente na aba "Entrega & Frete"

### ✅ Teste 2: Override de Transportadora
1. No pedido, trocar a transportadora manualmente
2. Salvar pedido
3. Reabrir pedido e verificar que transportadora escolhida foi persistida

### ⏳ Teste 3: Roteirização Define Previsão
1. Criar pedido sem rota
2. Verificar que campo "Previsão de Entrega" está vazio com helper text
3. Adicionar pedido a uma rota
4. Verificar que `scheduled_delivery_date` foi preenchido com data da rota

### ⏳ Teste 4: Retorno Confirma Entrega
1. Pedido roteirizado com previsão
2. No módulo Retorno, marcar como "Entregue"
3. Verificar que `delivered_at` foi gravado
4. Abrir pedido e ver ícone verde + "Entregue em DD/MM/AAAA HH:mm"

### ✅ Teste 5: Peso Bruto Automático
1. Cadastrar produto com `gross_weight_g_base` preenchido
2. Adicionar produto ao pedido
3. Verificar que "Peso Bruto (kg)" na aba "Entrega & Frete" foi calculado
4. Campo deve estar desabilitado (read-only)

---

## ARQUIVOS MODIFICADOS

### Novos
- `components/app/CarrierSelector.tsx`
- `supabase/migrations/20252001000000_delivery_and_weight_enhancements.sql`

### Modificados
- `lib/clients-db.ts` - função `getCarriers()`
- `types/sales.ts` - campos delivery tracking e gross weight
- `components/sales/TabDelivery.tsx` - UI completa
- `app/app/cadastros/pessoas-e-empresas/novo/page.tsx` - label "Região"
- `app/app/cadastros/pessoas-e-empresas/[id]/page.tsx` - label "Região"

---

## NOTAS TÉCNICAS

1. **Carrier Role**: Sistema usa `organization_roles.role = 'carrier'` para identificar transportadoras
2. **Peso Bruto Fallback**: Se produto não tem peso bruto, usa 110% do peso líquido
3. **Data de Entrega**: Campo antigo `delivery_date` permanece mas não é mais editável manualmente
4. **Confirmação Dialog**: Já implementado para mudança de cliente com dados de frete existentes
