# DIAGNÓSTICO: AUTOSAVE EM PEDIDOS/ORÇAMENTOS

## ETAPA 1 — MAPEAMENTO COMPLETO DO AUTOSAVE ATUAL

### 📍 Arquivo Principal
`components/sales/order/SalesOrderForm.tsx` (2116 linhas)

### 🔴 PONTOS DE AUTOSAVE IDENTIFICADOS

#### 1. **`ensureDraftOrder()` - Linha 1109**
**Criticidade:** 🔴 ALTA - Principal ponto de autosave

**O que faz:**
- Cria automaticamente um rascunho no banco quando necessário
- É chamado ANTES de adicionar itens
- Persiste o pedido mesmo sem o usuário clicar em "Salvar"

**Quando é chamado:**
- Ao adicionar item (`addQuickItem` - linha 507)
- Potencialmente em outros handlers

**Código:**
```typescript
async ensureDraftOrder(clientId?: string): Promise<string> {
    // Se já tem ID, retorna
    if (order.id) return order.id;
    
    // AUTOSAVE: Cria rascunho automaticamente
    const { data, error } = await upsertSalesDocument(supabase, {
        company_id: selectedCompany!.id,
        client_id: clientId || order.client_id,
        doc_type: order.doc_type || 'proposal',
        status_commercial: 'draft',
        // ... outros campos
    });
    
    // Atualiza estado local com ID do banco
    setOrder(prev => ({ ...prev, id: data.id }));
    return data.id;
}
```

#### 2. **`addQuickItem()` - Linha 507**
**Criticidade:** 🔴 ALTA

**O que faz:**
- Chama `ensureDraftOrder()` para garantir que existe ID
- Insere item no banco via `upsertSalesItem()`
- Salva IMEDIATAMENTE após adicionar item

**Código:**
```typescript
async addQuickItem() {
    // 1. AUTOSAVE: Garante que pedido existe no banco
    const orderId = await ensureDraftOrder(order.client_id);
    
    // 2. AUTOSAVE: Salva item no banco
    const { data: savedItem } = await upsertSalesItem(supabase, {
        document_id: orderId,
        item_id: quickItem.product_id,
        quantity: quickItem.quantity,
        // ...
    });
    
    // 3. Atualiza estado local
    setItems(prev => [...prev, savedItem]);
}
```

#### 3. **`handleUpdateItem()` - Linha 609**
**Criticidade:** 🔴 ALTA

**O que faz:**
- Atualiza item no banco IMEDIATAMENTE quando quantidade/preço/desconto muda
- Chama `upsertSalesItem()` a cada alteração

**Código:**
```typescript
async handleUpdateItem(index: number, field: keyof SalesOrderItem, value: any) {
    const item = items[index];
    const updated = { ...item, [field]: value };
    
    // Recalcula totais
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
        updated.total_amount = (updated.quantity * updated.unit_price) - updated.discount_amount;
    }
    
    // AUTOSAVE: Salva no banco imediatamente
    if (order.id && updated.id) {
        await upsertSalesItem(supabase, updated);
    }
    
    // Atualiza estado local
    setItems(prev => prev.map((it, i) => i === index ? updated : it));
}
```

#### 4. **`handleRemoveItem()` - Linha 577**
**Criticidade:** 🟡 MÉDIA

**O que faz:**
- Remove item do banco via `deleteSalesItem()`
- Salva remoção imediatamente

**Código:**
```typescript
async handleRemoveItem(index: number) {
    const item = items[index];
    
    // AUTOSAVE: Remove do banco
    if (item.id && order.id) {
        await deleteSalesItem(supabase, item.id);
    }
    
    // Remove do estado local
    setItems(prev => prev.filter((_, i) => i !== index));
}
```

#### 5. **`refreshTotals()` - Linha 244**
**Criticidade:** 🟢 BAIXA - Apenas leitura

**O que faz:**
- Busca totais atualizados do banco (peso, frete, etc.)
- NÃO salva, apenas lê

---

### 🔄 FLUXO ATUAL DE CRIAÇÃO

```
1. Usuário abre "Novo Pedido"
   └─ Estado: Apenas local, SEM ID

2. Usuário seleciona cliente
   └─ Estado: Apenas local, SEM ID

3. Usuário adiciona PRIMEIRO item
   ├─ addQuickItem() é chamado
   ├─ ensureDraftOrder() cria rascunho no banco 🔴
   ├─ upsertSalesItem() salva item no banco 🔴
   └─ Estado: TEM ID, pedido existe no banco

4. Usuário altera quantidade
   ├─ handleUpdateItem() é chamado
   ├─ upsertSalesItem() atualiza banco 🔴
   └─ Estado: Atualizado no banco

5. Usuário clica "Salvar Rascunho"
   ├─ executeSave('draft') é chamado
   └─ Apenas atualiza campos do cabeçalho (já estava salvo)

6. Usuário clica "Confirmar"
   ├─ executeConfirm() é chamado
   ├─ Muda status_commercial para 'confirmed'
   └─ Executa cálculo fiscal
```

---

### ⚠️ TRIGGERS E ROTINAS PESADAS

#### Triggers Identificados:
1. **`trigger_update_gross_weight`** (sales_document_items)
   - Recalcula peso bruto do pedido
   - Executa AFTER INSERT/UPDATE/DELETE em items
   - **Impacto:** Executa a cada item adicionado/modificado

2. **`trg_compute_sales_item_weight`** (sales_document_items)
   - Calcula peso do item baseado no produto
   - Executa BEFORE INSERT/UPDATE
   - **Impacto:** Executa a cada item adicionado/modificado

3. **Cálculo Fiscal** (manual, via `triggerFiscalCalculation`)
   - Calcula impostos (ICMS, PIS, COFINS, etc.)
   - Executa apenas ao Confirmar
   - **Impacto:** Pesado, mas controlado

---

### 📊 RESUMO DO AUTOSAVE

| Ação do Usuário | Autosave? | Função | Impacto |
|-----------------|-----------|--------|---------|
| Selecionar cliente | ❌ NÃO | - | - |
| Adicionar 1º item | ✅ SIM | `ensureDraftOrder()` + `upsertSalesItem()` | Cria pedido + item |
| Adicionar 2º+ item | ✅ SIM | `upsertSalesItem()` | Adiciona item |
| Alterar quantidade | ✅ SIM | `upsertSalesItem()` | Atualiza item |
| Alterar preço | ✅ SIM | `upsertSalesItem()` | Atualiza item |
| Alterar desconto | ✅ SIM | `upsertSalesItem()` | Atualiza item |
| Remover item | ✅ SIM | `deleteSalesItem()` | Remove item |
| Alterar frete | ❌ NÃO* | - | Apenas local |
| Salvar Rascunho | ✅ SIM | `executeSave('draft')` | Atualiza cabeçalho |
| Confirmar | ✅ SIM | `executeConfirm()` | Confirma + fiscal |

*Nota: Frete pode ser salvo via `executeSave()` mas não automaticamente

---

### 🎯 CONCLUSÃO DO DIAGNÓSTICO

**Autosave está ATIVO em:**
1. ✅ Criação de pedido (ao adicionar 1º item)
2. ✅ Adição de itens
3. ✅ Modificação de itens (quantidade, preço, desconto)
4. ✅ Remoção de itens

**Autosave NÃO está ativo em:**
1. ❌ Seleção de cliente
2. ❌ Alteração de campos do cabeçalho (frete, observações, etc.)

**Impacto:**
- Múltiplas gravações no banco durante edição
- Triggers executam a cada item modificado
- Usuário não tem controle sobre quando salvar
- Dificulta rollback de alterações

---

## PRÓXIMOS PASSOS

ETAPA 2: Implementar novo padrão de persistência
- Criar estado "dirty" (snapshot vs draft)
- Desabilitar todos os autosaves
- Criar função única de persistência
- Adicionar botão "Salvar" quando dirty=true
