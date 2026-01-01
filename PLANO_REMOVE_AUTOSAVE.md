# PLANO DE IMPLEMENTAÇÃO: REMOVER AUTOSAVE

## OBJETIVO
Remover autosave e implementar salvamento explícito apenas.

---

## ETAPA 2 — NOVO PADRÃO DE PERSISTÊNCIA

### 2.1 Estado Local (Form State)

#### Estrutura de Estado Proposta:

```typescript
// Estado atual (simplificado)
const [order, setOrder] = useState<Partial<SalesOrder>>(initialData || {});
const [items, setItems] = useState<SalesOrderItem[]>(initialData?.items || []);

// NOVO: Adicionar snapshot e dirty tracking
const [originalSnapshot, setOriginalSnapshot] = useState<{
    order: Partial<SalesOrder>;
    items: SalesOrderItem[];
} | null>(null);

const [isDirty, setIsDirty] = useState(false);
```

#### Lógica de Dirty Detection:

```typescript
useEffect(() => {
    if (!originalSnapshot) return;
    
    // Compare order fields
    const orderChanged = JSON.stringify(order) !== JSON.stringify(originalSnapshot.order);
    
    // Compare items
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(originalSnapshot.items);
    
    setIsDirty(orderChanged || itemsChanged);
}, [order, items, originalSnapshot]);
```

---

### 2.2 Função Única de Persistência

#### Nova Função: `saveSalesDocumentDraft()`

```typescript
async function saveSalesDocumentDraft(): Promise<{ success: boolean; orderId?: string }> {
    try {
        setSaving(true);
        
        // 1. Validação básica
        if (!order.client_id) {
            toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
            return { success: false };
        }
        
        // 2. Salvar/atualizar cabeçalho (sales_documents)
        const { data: savedOrder, error: orderError } = await upsertSalesDocument(supabase, {
            ...order,
            company_id: selectedCompany!.id,
        });
        
        if (orderError) throw orderError;
        
        const orderId = savedOrder.id;
        
        // 3. Sincronizar itens (diff-based)
        await syncItems(orderId, items, originalSnapshot?.items || []);
        
        // 4. Refetch completo para garantir consistência
        const freshOrder = await getSalesDocumentById(supabase, orderId);
        
        // 5. Atualizar snapshot e estado
        setOrder(freshOrder);
        setItems(freshOrder.items || []);
        setOriginalSnapshot({
            order: freshOrder,
            items: freshOrder.items || []
        });
        setIsDirty(false);
        
        toast({ title: "Sucesso", description: "Pedido salvo com sucesso" });
        
        return { success: true, orderId };
        
    } catch (error) {
        console.error("Erro ao salvar:", error);
        toast({ title: "Erro", description: "Falha ao salvar pedido", variant: "destructive" });
        return { success: false };
    } finally {
        setSaving(false);
    }
}

// Helper: Sincronizar itens (diff)
async function syncItems(
    orderId: string, 
    currentItems: SalesOrderItem[], 
    originalItems: SalesOrderItem[]
) {
    // Items to insert (no id or temp id)
    const toInsert = currentItems.filter(item => !item.id || item.id.startsWith('temp-'));
    
    // Items to update (has real id, exists in original)
    const toUpdate = currentItems.filter(item => 
        item.id && 
        !item.id.startsWith('temp-') &&
        originalItems.some(orig => orig.id === item.id)
    );
    
    // Items to delete (in original but not in current)
    const currentIds = new Set(currentItems.map(i => i.id).filter(id => id && !id.startsWith('temp-')));
    const toDelete = originalItems.filter(item => 
        item.id && 
        !currentIds.has(item.id)
    );
    
    // Execute in order
    for (const item of toInsert) {
        await upsertSalesItem(supabase, { ...item, document_id: orderId });
    }
    
    for (const item of toUpdate) {
        await upsertSalesItem(supabase, item);
    }
    
    for (const item of toDelete) {
        await deleteSalesItem(supabase, item.id!);
    }
}
```

---

### 2.3 Desligar Autosaves Existentes

#### Mudanças Necessárias:

##### 1. **`addQuickItem()` - REMOVER autosave**

```typescript
// ANTES (com autosave)
async addQuickItem() {
    const orderId = await ensureDraftOrder(order.client_id); // 🔴 AUTOSAVE
    const { data: savedItem } = await upsertSalesItem(supabase, {...}); // 🔴 AUTOSAVE
    setItems(prev => [...prev, savedItem]);
}

// DEPOIS (sem autosave)
function addQuickItem() {
    const newItem: SalesOrderItem = {
        id: `temp-${Date.now()}`, // Temporary ID
        item_id: quickItem.product_id,
        quantity: quickItem.quantity,
        unit_price: quickItem.price,
        // ... outros campos
        total_amount: quickItem.quantity * quickItem.price
    };
    
    setItems(prev => [...prev, newItem]);
    // Não salva no banco! Apenas atualiza estado local
}
```

##### 2. **`handleUpdateItem()` - REMOVER autosave**

```typescript
// ANTES (com autosave)
async handleUpdateItem(index: number, field: keyof SalesOrderItem, value: any) {
    const updated = { ...items[index], [field]: value };
    
    if (order.id && updated.id) {
        await upsertSalesItem(supabase, updated); // 🔴 AUTOSAVE
    }
    
    setItems(prev => prev.map((it, i) => i === index ? updated : it));
}

// DEPOIS (sem autosave)
function handleUpdateItem(index: number, field: keyof SalesOrderItem, value: any) {
    const updated = { ...items[index], [field]: value };
    
    // Recalcular totais
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
        updated.total_amount = (updated.quantity * updated.unit_price) - updated.discount_amount;
    }
    
    setItems(prev => prev.map((it, i) => i === index ? updated : it));
    // Não salva no banco! Apenas atualiza estado local
}
```

##### 3. **`handleRemoveItem()` - REMOVER autosave**

```typescript
// ANTES (com autosave)
async handleRemoveItem(index: number) {
    const item = items[index];
    
    if (item.id && order.id) {
        await deleteSalesItem(supabase, item.id); // 🔴 AUTOSAVE
    }
    
    setItems(prev => prev.filter((_, i) => i !== index));
}

// DEPOIS (sem autosave)
function handleRemoveItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
    // Não remove do banco! Apenas remove do estado local
    // Será removido ao salvar (via syncItems)
}
```

##### 4. **`ensureDraftOrder()` - REMOVER completamente**

```typescript
// ANTES: Função que criava autosave
async ensureDraftOrder(clientId?: string): Promise<string> {
    if (order.id) return order.id;
    // ... criava rascunho automaticamente
}

// DEPOIS: Não existe mais!
// A criação só acontece em saveSalesDocumentDraft()
```

---

### 2.4 Atualizar Botões de Ação

#### Botão "Salvar" (novo, apenas quando dirty)

```typescript
// Renderizar apenas quando editando E dirty
{mode === 'edit' && isDirty && (
    <Button
        onClick={saveSalesDocumentDraft}
        disabled={saving}
        className="bg-truegold-600 hover:bg-truegold-700"
    >
        {saving ? (
            <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
            </>
        ) : (
            <>
                <Save className="w-4 h-4 mr-2" />
                Salvar
            </>
        )}
    </Button>
)}
```

#### Botão "Salvar Rascunho" (atualizar)

```typescript
// ANTES
async handleSaveDraft() {
    await executeSave('draft');
}

// DEPOIS
async handleSaveDraft() {
    // Salvar tudo primeiro
    const result = await saveSalesDocumentDraft();
    
    if (!result.success) return;
    
    // Garantir que status é draft
    await upsertSalesDocument(supabase, {
        id: result.orderId,
        status_commercial: 'draft'
    });
    
    toast({ title: "Sucesso", description: "Rascunho salvo" });
}
```

#### Botão "Confirmar" (atualizar)

```typescript
// ANTES
async executeConfirm() {
    await confirmOrder(supabase, order.id!, selectedCompany!.id);
    // ... fiscal
}

// DEPOIS
async executeConfirm() {
    // 1. Salvar tudo primeiro
    const result = await saveSalesDocumentDraft();
    
    if (!result.success) return;
    
    // 2. Confirmar
    await confirmOrder(supabase, result.orderId!, selectedCompany!.id);
    
    // 3. Fiscal (se aplicável)
    await triggerFiscalCalculation();
    
    toast({ title: "Sucesso", description: "Pedido confirmado" });
}
```

---

### 2.5 UX de Segurança

#### Confirmação ao Sair (dirty)

```typescript
useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = 'Você tem alterações não salvas. Deseja sair mesmo assim?';
        }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}, [isDirty]);
```

#### Bloqueio de Múltiplos Cliques

```typescript
// Já existe via `saving` state
<Button
    onClick={saveSalesDocumentDraft}
    disabled={saving} // ✅ Bloqueia durante salvamento
>
    {saving ? 'Salvando...' : 'Salvar'}
</Button>
```

---

## ETAPA 3 — CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Preparação
- [ ] Criar branch: `feature/remove-autosave`
- [ ] Backup do componente atual
- [ ] Criar testes manuais

### Fase 2: Implementação
- [ ] Adicionar `originalSnapshot` e `isDirty` ao estado
- [ ] Implementar `saveSalesDocumentDraft()` e `syncItems()`
- [ ] Remover autosave de `addQuickItem()`
- [ ] Remover autosave de `handleUpdateItem()`
- [ ] Remover autosave de `handleRemoveItem()`
- [ ] Remover função `ensureDraftOrder()`
- [ ] Adicionar botão "Salvar" (dirty only)
- [ ] Atualizar "Salvar Rascunho"
- [ ] Atualizar "Confirmar"
- [ ] Adicionar `beforeunload` handler

### Fase 3: Testes
- [ ] Criar novo pedido → adicionar itens → salvar
- [ ] Editar pedido → alterar quantidade → salvar
- [ ] Editar pedido → remover item → salvar
- [ ] Tentar sair sem salvar → confirmar alerta
- [ ] Confirmar pedido → verificar fiscal

### Fase 4: Deploy
- [ ] Code review
- [ ] Merge para main
- [ ] Deploy em produção
- [ ] Monitorar erros

---

## ARQUIVOS A MODIFICAR

1. **`components/sales/order/SalesOrderForm.tsx`** (principal)
   - Adicionar dirty tracking
   - Implementar saveSalesDocumentDraft()
   - Remover autosaves
   - Adicionar botão Salvar

2. **`lib/data/sales-orders.ts`** (se necessário)
   - Verificar se upsertSalesDocument suporta transações

---

## RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|-------|-----------|
| Perda de dados ao sair sem salvar | Confirmação beforeunload |
| Usuário esquece de salvar | Botão "Salvar" visível quando dirty |
| Erro ao salvar deixa estado inconsistente | Manter dirty=true, permitir retry |
| Performance ao salvar muitos itens | Usar Promise.all() em syncItems |

---

## PRÓXIMO PASSO

Implementar ETAPA 2.1: Adicionar dirty tracking ao componente.
