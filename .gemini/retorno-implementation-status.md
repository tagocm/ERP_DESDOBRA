# Implementação da Tela de Retorno - Status Atual

## ✅ Implementado

### 1. Filtro de Expedição
- **Arquivo**: `lib/data/expedition.ts`
- **Mudança**: `getExpeditionRoutes` agora filtra apenas rotas com `status != 'in_progress'`
- **Resultado**: Expedição mostra apenas rotas AGENDADAS (não iniciadas)

### 2. Atualização de Status ao Iniciar Rota
- **Arquivo**: `app/api/expedition/start-route/route.ts`
- **Mudança**: Ao iniciar rota, atualiza `delivery_routes.status = 'in_progress'`
- **Resultado**: Rota desaparece da Expedição após iniciar

### 3. Função para Buscar Rotas em Retorno
- **Arquivo**: `lib/data/expedition.ts`
- **Nova função**: `getRetornoRoutes()`
- **Resultado**: Busca apenas rotas com `status = 'in_progress'`

### 4. Nova Página Retorno
- **Arquivo**: `app/app/logistica/retorno/page.tsx`
- **Resultado**: Página servidor-side que busca rotas em andamento

### 5. Componente RetornoClient
- **Arquivo**: `components/retorno/RetornoClient.tsx`
- **Resultado**: 
  - Mesma estrutura visual da Expedição
  - Lista de rotas à esquerda
  - Detalhes à direita
  - Botão "Finalizar Retorno" (placeholder)

### 6. Componente RouteDetails (Retorno)
- **Arquivo**: `components/retorno/RouteDetails.tsx`
- **Resultado**: 
  - Tabs: "Checklist de Retorno" e "Resumo"
  - Estrutura básica funcionando
  - Checklist ainda não implementado (placeholder)

## 🚧 Pendente de Implementação

### 1. Menu Item para Retorno
- **Arquivo**: Arquivo de navegação/menu (precisa ser identificado)
- **Ação**: Adicionar item "Retorno" no menu de Logística

### 2. Checklist de Retorno
Criar componente similar ao `LoadingChecklist.tsx` mas para retorno:

**Estados possíveis por pedido**:
- ✅ **ENTREGUE** (verde)
- 🟡 **DEVOLVIDO PARCIAL** (amarelo) - abre modal
- 🔴 **DEVOLVIDO** (vermelho) - abre modal  
- 🟠 **NÃO ENTREGUE** (vermelho/laranja) - abre modal

**Modais necessários**:
- `PartialReturnModal.tsx` - para devoluções parciais (itens/volumes + motivo)
- `FullReturnModal.tsx` - para devolução total (motivo)
- `NotDeliveredModal.tsx` - para não entregue (motivo: cliente fechado, recusou, etc.)

### 3. API de Finalização
Criar endpoint `/api/retorno/finish-route`:
- Validar se todos os pedidos têm status definido
- Atualizar `status_logistic` de cada pedido:
  - ENTREGUE → `entregue`
  - DEVOLVIDO → `nao_entregue` (ou `devolvido`)
  - DEVOLVIDO PARCIAL → `nao_entregue` + gerar pedido de ajuste
  - NÃO ENTREGUE → `nao_entregue`
- Registrar observações internas nos pedidos
- Atualizar status da rota:
  - Todos entregues → `completed`
  - Com ocorrências → `completed_with_issues`
- Retornar sucesso

### 4. Toast com Link
Adicionar toast após "Iniciar Rota" com botão:
- "Rota iniciada! [Ir para Retorno] →"
- Link para `/app/logistica/retorno`

### 5. Staging de Status
Implementar sistema de staging similar ao da Expedição:
- Estado local mantém escolhas do usuário
- Nada é gravado até clicar "Finalizar Retorno"
- Visual feedback de pedidos pendentes vs processados

## 📋 Próximos Passos Sugeridos

1. **Adicionar item no menu** (rápido)
2. **Criar ReturnChecklist component** (core da funcionalidade)
3. **Criar modais de retorno** (3 modais)
4. **Criar API de finalização** (lógica de negócio)
5. **Adicionar toast com link** (UX)
6. **Testar fluxo completo**

## 🗂️ Arquitetura Atual

```
/app/app/logistica/
  ├── expedicao/page.tsx     → Rotas AGENDADAS
  └── retorno/page.tsx       → Rotas EM_ROTA

/components/
  ├── expedicao/
  │   ├── ExpedicaoClient.tsx
  │   ├── LoadingChecklist.tsx
  │   └── RouteDetails.tsx
  └── retorno/
      ├── RetornoClient.tsx      ✅ Criado
      ├── RouteDetails.tsx       ✅ Criado (básico)
      ├── ReturnChecklist.tsx    🚧 Pendente
      ├── PartialReturnModal.tsx 🚧 Pendente
      ├── FullReturnModal.tsx    🚧 Pendente
      └── NotDeliveredModal.tsx  🚧 Pendente

/lib/data/
  └── expedition.ts
      ├── getExpeditionRoutes()  ✅ Atualizado
      └── getRetornoRoutes()     ✅ Criado

/app/api/
  └── expedition/
      └── start-route/route.ts   ✅ Atualizado
  └── retorno/                   🚧 Pendente
      └── finish-route/route.ts  🚧 Pendente
```

## 🎯 Critérios de Aceite (Status)

1. ✅ Expedição lista só AGENDADAS
2. ✅ Retorno lista só EM_ROTA  
3. ✅ Ao iniciar rota, ela sai da Expedição e aparece no Retorno
4. 🚧 No Retorno, é possível marcar cada pedido (em desenvolvimento)
5. 🚧 Nada é gravado até clicar "Finalizar Retorno" (em desenvolvimento)
6. 🚧 Após encerrar, a rota some do Retorno (em desenvolvimento)

---

**Status Geral**: 50% implementado
**Próxima etapa crítica**: ReturnChecklist component
