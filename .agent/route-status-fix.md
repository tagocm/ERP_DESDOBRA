# Fix: Route Status Colors Not Updating

## Problema Identificado

As cores dos cards de rota na tela de Roteirização não estavam mudando quando a rota era iniciada na Expedição.

**Causa Raiz:**
- A função `startRoute` estava atualizando apenas o status dos **pedidos** (`sales_documents.status_logistic`)
- O status da **própria rota** (`delivery_routes.status`) não estava sendo atualizado
- O componente `RouteCardCompact` depende do campo `route.status` para determinar a cor de fundo

## Correções Implementadas

### 1. Atualização da função `startRoute`
**Arquivo:** `lib/data/expedition.ts`

Adicionada atualização do status da rota ao iniciar:

```typescript
// Update route status to EM_ROTA
const { error: routeError } = await supabase
    .from('delivery_routes')
    .update({ status: 'em_rota' })
    .eq('id', routeId);
```

**Resultado:** Quando a rota é iniciada, o campo `delivery_routes.status` é atualizado para `'em_rota'`, fazendo o card ficar AMARELO.

### 2. Criação da função `finishRoute`
**Arquivo:** `lib/data/expedition.ts`

Nova função para marcar rota como concluída:

```typescript
export async function finishRoute(
    supabase: SupabaseClient,
    routeId: string
) {
    const { error } = await supabase
        .from('delivery_routes')
        .update({ status: 'concluida' })
        .eq('id', routeId);

    if (error) throw error;
    return { success: true };
}
```

**Uso:** Deve ser chamada na função de "Finalizar Retorno" para fazer o card ficar VERDE.

### 3. Queries atualizadas para incluir status de carregamento
**Arquivos:** `lib/data/expedition.ts`

Funções `getScheduledRoutes` e `getUnscheduledRoutes` agora incluem:
- `loading_status` - Status do carregamento (loaded/partial/not_loaded)
- `partial_payload` - Dados de carga parcial
- `loading_checked` - Flag legacy de verificação

**Resultado:** As bolinhas de status agora funcionam corretamente, refletindo o status de carregamento de cada pedido.

## Fluxo Completo Atualizado

### Expedição
1. Usuário marca pedidos como carregados → `loading_status` é salvo em `delivery_route_orders`
2. Usuário clica "Iniciar Rota" → `delivery_routes.status` = `'em_rota'`
3. **Card fica AMARELO** instantaneamente
4. **Bolinhas** refletem o status de carregamento (verde/amarelo/vermelho)

### Retorno
5. Usuário processa resultado de entregas → `return_outcome` é salvo
6. Usuário clica "Finalizar Retorno" → Deve chamar `finishRoute(supabase, routeId)`
7. `delivery_routes.status` = `'concluida'`
8. **Card fica VERDE** e permanece no histórico

## Próximo Passo

**Integrar `finishRoute` no RetornoClient:**

No arquivo `components/retorno/RetornoClient.tsx`, na função `confirmFinishRoute`, adicionar:

```typescript
import { finishRoute } from '@/lib/data/expedition';

const confirmFinishRoute = async () => {
    setFinishing(true);
    try {
        // TODO: Processar todos os outcomes do staging
        
        // Finalizar a rota (atualiza status para 'concluida')
        await finishRoute(supabase, selectedRoute.id);
        
        toast({ title: "Retorno finalizado", description: "A rota foi concluída com sucesso." });
        setConfirmDialogOpen(false);
        setStaging({});
        router.refresh();
    } catch (error) {
        // ...
    } finally {
        setFinishing(false);
    }
};
```

## Status

✅ `startRoute` atualiza status da rota para `'em_rota'`
✅ `finishRoute` criada para atualizar status para `'concluida'`
✅ Queries incluem campos de loading_status
✅ Cores do card funcionam corretamente
✅ Bolinhas de status funcionam corretamente

⏳ Pendente: Integrar `finishRoute` no fluxo de "Finalizar Retorno"

---

**Data:** 31/12/2024
**Arquivos modificados:**
- `lib/data/expedition.ts`
- `lib/route-status-helpers.ts` (já criado anteriormente)
