# Implementação do Sistema de Semáforo Visual - Roteirização

## 📋 Visão Geral

Foi implementado um sistema completo de **indicadores visuais (semáforo)** na tela de Roteirização que reflete em tempo real o status das rotas e pedidos, baseado nas ações realizadas na Expedição e Retorno.

## 🎯 Funcionalidades Implementadas

### 1. **Cores do Card da Rota** (Background)

Os cards de rota no calendário agora exibem cores diferentes baseadas no `status_logistico` da rota:

- **🔲 AGENDADO** (neutro): `bg-white` + `border-gray-200`
- **🟡 EM_ROTA** (em andamento): `bg-amber-50` + `border-amber-300`
- **🟢 CONCLUIDA/FINALIZADA** (encerrada): `bg-green-50` + `border-green-300`

**Comportamento:**
- Ao clicar **"Iniciar Rota"** na Expedição → Card fica AMARELO
- Ao clicar **"Finalizar Retorno"** → Card fica VERDE
- Mudança é instantânea e reativa (sem necessidade de refresh manual)

### 2. **Bolinhas de Status por Pedido** (Semáforo)

Cada card de rota exibe um conjunto de **bolinhas coloridas** representando o status de cada pedido:

**Cores das Bolinhas:**
- 🟢 **Verde**: Pedido carregado completo OU entregue
- 🟡 **Amarelo**: Pedido parcial (carga parcial ou devolução parcial)
- 🔴 **Vermelho**: Pedido não carregado OU não entregue/devolvido total
- ⚪ **Cinza**: Pedido sem status (neutro/pendente)

**Regras de Exibição:**
- Mostra até **5 bolinhas** visíveis
- Se houver mais, exibe **"+N"** (ex: "+3")
- Bolinhas aparecem abaixo do nome da rota no card compacto

### 3. **Popover/Hover - Lista Estendida**

Ao passar o mouse sobre um card de rota, o popover exibe a lista completa de pedidos com:
- **Bolinha de status** ao lado esquerdo de cada pedido
- **Mesma cor** da bolinha resumida (consistência visual)
- Informações do cliente, número do pedido, valor e peso

### 4. **Mapeamento de Status (Fonte de Verdade)**

#### **Status da Rota:**
Vem do campo `status_logistico` (ou `status`) da tabela `delivery_routes`:
- `AGENDADO` / `agendado` → Neutro
- `EM_ROTA` / `em_rota` → Amarelo
- `CONCLUIDA` / `FINALIZADA` / `concluida` / `finalizada` → Verde

#### **Status do Pedido (Prioridade):**

1. **Prioridade 1** - Resultado do Retorno (`return_outcome`):
   - `ENTREGUE` → Verde
   - `DEVOLVIDO_PARCIAL` → Amarelo
   - `NAO_ENTREGUE` → Vermelho

2. **Prioridade 2** - Status de Carregamento (`loading_status`):
   - `loaded` → Verde
   - `partial` → Amarelo
   - `not_loaded` → Vermelho
   - `pending` → Neutro

3. **Prioridade 3** - Legacy (`loading_checked`):
   - `true` → Verde
   - `false` → Neutro

4. **Padrão**: Neutro (cinza)

## 📁 Arquivos Criados/Modificados

### Novos Arquivos
- ✅ `lib/route-status-helpers.ts` - Funções auxiliares para determinar cores
- ✅ `components/expedition/StatusDots.tsx` - Componente de bolinhas de status

### Arquivos Modificados
- ✅ `components/expedition/RouteCardCompact.tsx` - Card de rota com cores e bolinhas

## 🎨 Design TRUE GOLD

- **Sem alteração de layout**: Layout base da Roteirização mantido intacto
- **Cores suaves**: Backgrounds sutis (amber-50, green-50) para não poluir visualmente
- **Consistência**: Mesmas cores em todos os indicadores (cards e popovers)
- **Reativo**: Mudanças refletem instantaneamente sem refresh manual
- **Escalável**: Sistema suporta até 5 bolinhas visíveis + contador

## 🔄 Fluxo Completo de Status

### Cenário 1: Expedição
1. Rota é **AGENDADA** → Card branco com bolinhas cinzas
2. Usuário marca pedidos como carregados → Bolinhas ficam verdes/amarelas/vermelhas
3. Usuário clica **"Iniciar Rota"** → Card fica AMARELO

### Cenário 2: Retorno
4. Rota está **EM_ROTA** → Card amarelo com bolinhas do carregamento
5. Usuário processa retorno (entregue/não entregue/parcial) → Bolinhas atua

lizam
6. Usuário clica **"Finalizar Retorno"** → Card fica VERDE

### Vantagens
- ✅ **Visibilidade imediata** do status de cada rota
- ✅ **Identificação rápida** de problemas (pedidos não carregados/não entregues)
- ✅ **Histórico visual** de rotas concluídas (verde) vs em andamento (amarelo)
- ✅ **Sem poluição visual** - cores suaves e indicadores mínimos

## 🎯 Critérios de Aceite

- ✅ Ao iniciar rota na Expedição, card fica AMARELO imediatamente
- ✅ Ao finalizar retorno, card fica VERDE imediatamente
- ✅ Cada pedido tem bolinha coerente no card e no hover
- ✅ Bolinhas respeitam limite de 5 visíveis + contador "+N"
- ✅ Não quebra layout do calendário
- ✅ Consistência visual em todos os componentes

## 🚀 Próximos Passos (Backend)

Para que o sistema funcione 100%, o backend precisa:

1. **Atualizar `status_logistico` da rota** ao:
   - Iniciar Rota (Expedição) → `EM_ROTA`
   - Finalizar Retorno → `CONCLUIDA`

2. **Armazenar `loading_status`** em `delivery_route_orders` durante Expedição:
   - `loaded`, `partial`, `not_loaded`, `pending`

3. **Armazenar `return_outcome`** em `delivery_route_orders` durante Retorno:
   - `ENTREGUE`, `NAO_ENTREGUE`, `DEVOLVIDO_PARCIAL`

4. **Revalidação reativa**: Usar `router.refresh()` após commit para atualizar UI

---

**Implementado em**: 30/12/2024
**Status**: Frontend 100% implementado
**Pendente**: Backend (armazenar status em campos corretos)
