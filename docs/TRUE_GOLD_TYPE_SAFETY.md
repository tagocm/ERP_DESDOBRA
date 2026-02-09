# TRUE GOLD: Type Safety Patterns

## 🎯 Regra de Ouro

> **UI sempre usa DTOs, nunca entidades do domínio.**

## 📋 Padrões Estabelecidos

### 1. Separação de Camadas

```
┌─────────────────────────────────────┐
│  UI Layer (components/)             │
│  ✅ Usa: DTOs de lib/types/*-dto.ts │
│  ❌ Nunca: Entidades de types/*.ts  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Data Layer (lib/data/)             │
│  ✅ Usa: Entidades + DTOs           │
│  Converte: Entity → DTO             │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Domain Layer (types/)              │
│  Entidades do banco/domínio         │
└─────────────────────────────────────┘
```

### 2. Tipos Mínimos por Componente

**Evite acoplamento ao DTO grande. Crie tipos locais.**

```typescript
// ❌ ERRADO - Acoplamento excessivo
import { DeliveryRouteDTO } from '@/lib/types/expedition-dto';

interface Props {
    route: DeliveryRouteDTO;  // Componente recebe DTO inteiro
}

// ✅ CORRETO - Tipo mínimo local
// components/expedition/types.ts
export type RouteForCalendar = {
    id: string;
    name: string;
    scheduled_date: string | null;
    orders: Array<{
        sales_order: { total_weight_kg: number } | null;
    }>;
};

interface Props {
    route: RouteForCalendar;  // Componente recebe só o necessário
}
```

### 3. Null-Safety em Funções Utilitárias

**Aceite `null` e normalize dentro da função.**

```typescript
// ✅ CORRETO
type OrderForLabel = {
    id: string;
    document_number: string | null;  // Aceita null
    client?: { trade_name?: string | null } | null;
};

export function generateLabel(order: OrderForLabel) {
    const orderNum = order.document_number || "S/N";  // Normaliza
    const clientName = order.client?.trade_name || "CONSUMIDOR";
    // ...
}
```

### 4. Union Types Discriminados

**Preferir union types a objetos com propriedades opcionais.**

```typescript
// ❌ ERRADO - Propriedades opcionais
type DragItem = {
    type: 'order' | 'route';
    order?: SandboxOrderDTO;
    route?: DeliveryRouteDTO;
};

// ✅ CORRETO - Union type discriminado
type DragItem =
    | { type: 'order'; order: SandboxOrderDTO }
    | { type: 'route'; route: DeliveryRouteDTO };

// Type narrowing automático
if (dragData.type === 'order') {
    dragData.order.id;  // ✅ TypeScript sabe que order existe
}
```

### 5. ESLint Guardrails

**Previna regressão com regras de lint.**

```javascript
// eslint.config.mjs
export default [
    {
        files: ['components/expedition/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['@/types/sales'],
                    message: 'UI must not import domain entities. Use DTOs from @/lib/types/expedition-dto'
                }]
            }]
        }
    }
];
```

## ✅ Checklist para Novos Componentes

Ao criar componente de UI:

- [ ] Importa apenas DTOs de `lib/types/*-dto.ts`
- [ ] Cria tipo mínimo local se DTO for grande
- [ ] Aceita `null` em campos opcionais
- [ ] Usa union types discriminados quando aplicável
- [ ] Verifica que ESLint não reclama

## 🚫 Anti-Patterns

### ❌ Importar Entidade em UI

```typescript
// components/expedition/MyComponent.tsx
import { DeliveryRoute } from '@/types/sales';  // ❌ NUNCA!
```

### ❌ Usar `any` para Contornar Tipos

```typescript
const route: any = fetchRoute();  // ❌ Perde type safety
```

### ❌ Propriedades Opcionais em Vez de Union

```typescript
type Item = {
    type: 'a' | 'b';
    dataA?: DataA;  // ❌ Ambos podem estar undefined
    dataB?: DataB;
};
```

## 📚 Referências

- [Expedition Type Safety Walkthrough](file:///Users/tago/.gemini/antigravity/brain/edb5c412-1366-4f74-b758-e604ed8d25bc/expedition_type_safety_walkthrough.md)
- [Hardening Plan](file:///Users/tago/.gemini/antigravity/brain/edb5c412-1366-4f74-b758-e604ed8d25bc/hardening_plan.md)
