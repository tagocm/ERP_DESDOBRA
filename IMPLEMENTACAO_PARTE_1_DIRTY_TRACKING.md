# IMPLEMENTAÇÃO: REMOVER AUTOSAVE - PARTE 1
# Adicionar Dirty Tracking ao SalesOrderForm

## MUDANÇAS NO ESTADO

### 1. Adicionar ao início do componente (após linha 196):

```typescript
// ============================================
// DIRTY TRACKING STATE (No Autosave)
// ============================================
const [originalSnapshot, setOriginalSnapshot] = useState<{
    formData: Partial<SalesOrder>;
    items: SalesOrderItem[];
} | null>(null);

const [isDirty, setIsDirty] = useState(false);
```

### 2. Adicionar useEffect para detectar mudanças (após linha 242):

```typescript
// --- EFFECT: Detect Dirty State ---
useEffect(() => {
    if (!originalSnapshot || mode === 'create') {
        setIsDirty(false);
        return;
    }
    
    // Compare formData (excluding items)
    const { items: _, ...currentFormData } = formData;
    const { items: __, ...originalFormData } = originalSnapshot.formData;
    
    const formDataChanged = JSON.stringify(currentFormData) !== JSON.stringify(originalFormData);
    
    // Compare items
    const itemsChanged = JSON.stringify(formData.items) !== JSON.stringify(originalSnapshot.items);
    
    setIsDirty(formDataChanged || itemsChanged);
}, [formData, originalSnapshot, mode]);
```

### 3. Atualizar fetchData para criar snapshot (modificar função existente ~linha 307):

```typescript
const fetchData = async () => {
    setIsLoading(true);
    try {
        // ... código existente de fetch ...
        
        // NOVO: Criar snapshot após carregar
        if (mode === 'edit' && initialData) {
            setOriginalSnapshot({
                formData: initialData,
                items: initialData.items || []
            });
        }
        
    } catch (error) {
        // ... código existente ...
    } finally {
        setIsLoading(false);
    }
};
```

### 4. Adicionar beforeunload handler (após linha 242):

```typescript
// --- EFFECT: Warn on unsaved changes ---
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

## PRÓXIMO ARQUIVO

Parte 2: Implementar saveSalesDocumentDraft()
