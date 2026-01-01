# Implementação do Sistema de Retorno - Resumo

## 📋 Visão Geral

Foi implementado um sistema completo de "Checklist de Retorno" para a tela de Retorno, seguindo os mesmos padrões da Expedição com **staging** (pré-visualização) e **commit** (gravação no banco) apenas ao clicar "Finalizar Retorno".

## 🎯 Funcionalidades Implementadas

### 1. **Checklist de Retorno** (Tab Principal)

**Componente**: `ReturnChecklist.tsx`

- Lista todos os pedidos da rota em cards estilo Expedição
- Cada card mostra:
  - Cliente + Pedido # + Cidade
  - Peso do pedido + Volumes
  - Resumo de itens (1 linha) e total
  - Botão "Ver pedido" (abre em nova aba)

**Seletor de Resultado** (4 opções verticais):
- 🟢 **ENTREGUE**: Marca diretamente como entregue
- 🔴 **NÃO ENTREGUE**: Abre modal para informar motivo
- 🔴 **DEVOLVIDO TOTAL**: Abre modal para informar motivo
- 🟡 **DEVOLVIDO PARCIAL**: Abre modal para ajustar itens/quantidades

### 2. **Modais Implementados**

#### `NotDeliveredModal.tsx`
- Solicita motivo obrigatório
- Opções: Cliente ausente, recusou receber, endereço não localizado, etc.
- Campo de observações para "Outro"

#### `TotalReturnModal.tsx`
- Solicita motivo obrigatório
- Opções: Cliente recusou, problema de qualidade, produto incorreto, etc.
- Campo de observações para "Outro"

#### `PartialReturnModal.tsx`
- Tabela com todos os itens do pedido
- Campo "Qtd. Entregue" ajustável por item
- Calcula automaticamente "Qtd. Devolvida"
- Valida que pelo menos 1 item tenha pendência
- Exige motivo obrigatório
- Aviso sobre criação de pedido complementar

### 3. **Aba Resumo**

**Componente**: `ReturnSummary.tsx`

- **Contadores** com cards coloridos:
  - 🟢 Entregues
  - 🔴 Não Entregues
  - 🔴 Devolvidos Total
  - 🟡 Devolvidos Parcial

- **Validações e Alertas**:
  - Bloqueia finalização se houver pedidos sem resultado
  - Bloqueia finalização se houver pedidos sem motivo
  - Mensagens claras de validação

- **Lista de Ocorrências**:
  - Cards por exceção (não entregue, devolvido, parcial)
  - Mostra cliente, pedido, tipo e motivo
  - Preview do que acontecerá

### 4. **Sistema de Staging**

**Gerenciamento de Estado** (`RetornoClient.tsx`):
- Estado local `staging: Record<string, ReturnStaging>`
- Armazena por pedido:
  - `outcomeType`: tipo de resultado
  - `reason`: motivo (quando aplicável)
  - `payload`: dados adicionais (items devolvidos parcialmente)

**Características**:
- Nada é gravado no banco até clicar "Finalizar Retorno"
- Staging é resetado ao trocar de rota
- Validação completa antes de permitir finalização

### 5. **Modal de Confirmação**

**Componente**: `ConfirmDialogDesdobra`

- Título: "Finalizar Retorno"
- Mostra nome da rota
- **Resumo das ações**:
  - X pedidos serão marcados como ENTREGUE
  - Y pedidos voltarão para SANDBOX (não entregue)
  - Z pedidos voltarão para SANDBOX (devolução total)
  - W pedidos gerarão complementares (devolução parcial)
- Aviso: "Esta ação não pode ser desfeita"

### 6. **Validações Implementadas**

✅ Todos os pedidos devem ter um resultado definido
✅ Pedidos não entregues/devolvidos devem ter motivo
✅ Devolução parcial deve ter pelo menos 1 item devolvido
✅ Devolução parcial deve ter pelo menos 1 item entregue
✅ Feedback visual claro em cada etapa

## 🎨 Design e UX

- **Cards de Pedidos**: Mesmo estilo da Expedição
- **Background Color**: Muda conforme o outcome (verde, vermelho, amarelo)
- **Seletor Vertical**: 4 botões coloridos e intuitivos
- **Feedback Visual**: Line-through para pedidos não entregues/devolvidos
- **Responsivo**: Grid 4-8 (lista de rotas vs. detalhes)

## 📁 Arquivos Criados/Modificados

### Novos Componentes
- ✅ `components/retorno/ReturnOutcomeSelector.tsx`
- ✅ `components/retorno/NotDeliveredModal.tsx`
- ✅ `components/retorno/TotalReturnModal.tsx`
- ✅ `components/retorno/PartialReturnModal.tsx`
- ✅ `components/retorno/ReturnChecklist.tsx`
- ✅ `components/retorno/ReturnSummary.tsx`

### Componentes Modificados
- ✅ `components/retorno/RouteDetails.tsx`
- ✅ `components/retorno/RetornoClient.tsx`

## 🔄 Próximos Passos (Backend/API)

A implementação do **commit ao banco** ainda precisa ser feita. O flow esperado é:

### API Route: `/api/routes/[routeId]/finish-return`

**Payload esperado**:
```typescript
{
  staging: {
    [orderId]: {
      outcomeType: 'ENTREGUE' | 'NAO_ENTREGUE' | 'DEVOLVIDO' | 'DEVOLVIDO_PARCIAL',
      reason?: string,
      payload?: any
    }
  }
}
```

**Ações no Backend**:

1. **Para ENTREGUE**:
   - `sales_order.status_logistico = 'ENTREGUE'`
   - Adicionar observação interna: `"RETORNO rota {rota} em {data}: ENTREGUE."`

2. **Para NÃO ENTREGUE**:
   - `sales_order.status_logistico = 'PENDENTE'`
   - Desvincular da rota (voltar para SANDBOX)
   - Adicionar observação: `"RETORNO rota {rota} em {data}: NÃO ENTREGUE. Motivo: {motivo}. Pedido devolvido para SANDBOX."`

3. **Para DEVOLVIDO TOTAL**:
   - `sales_order.status_logistico = 'PENDENTE'`
   - Desvincular da rota (SANDBOX)
   - Adicionar observação: `"RETORNO rota {rota} em {data}: DEVOLVIDO. Motivo: {motivo}. Pedido devolvido para SANDBOX."`

4. **Para DEVOLVIDO PARCIAL**:
   - Atualizar pedido original com itens entregues
   - Criar pedido complementar com itens devolvidos
   - `sales_order.status_logistico = 'ENTREGUE'` (original)
   - Novo pedido complementar vai para SANDBOX
   - Adicionar observações em ambos os pedidos

5. **Finalizar a Rota**:
   - `delivery_route.status = 'CONCLUIDA'`
   - Remover da tela de Retorno

## ✨ Destaques da Implementação

1. **100% Staging**: Nada grava no banco até confirmação final
2. **Validação Robusta**: Bloqueia ações inválidas com mensagens claras
3. **UX Premium**: Feedback visual em cada etapa
4. **Reutilização**: Componentes e padrões da Expedição
5. **Type Safety**: TypeScript em todos os componentes
6. **Responsivo**: Layout adaptável e funcional

## 🎯 Status

✅ Frontend 100% implementado
⏳ Backend/API pendente
⏳ Testes de integração pendentes

---

**Implementado em**: 30/12/2024
**Complexidade**: Alta (8/10)
**Padrão**: TRUE GOLD - Expedição
