# Diagnóstico de Persistência: Expedição e Retorno

**Data:** 31/12/2025  
**Objetivo:** Verificar se o sistema respeita a regra de "Salvar alterações finais apenas ao clicar em 'Iniciar Rota' ou 'Finalizar Retorno'".

---

## 🔍 Resumo Executivo

O sistema implementa um padrão de **"Rascunho Persistido"** (*Draft Persistence*).
As interações do usuário (marcar checkboxes, selecionar motivos, digitar observações) são salvas imediatamente na tabela intermediária de relacionamento (`delivery_route_orders`).

No entanto, as **regras de negócio críticas** (alterar status logístico do pedido, baixar estoque, gerar lançamentos financeiros, dividir pedidos) são aplicadas **apenas** quando o usuário clica nos botões finais de confirmação ("Iniciar Rota" e "Finalizar Retorno").

Isto garante que:
1.  O trabalho do usuário não é perdido se a página for recarregada (persistência de rascunho).
2.  O pedido de venda original (`sales_documents`) permanece inalterado até a decisão final.

**CONCLUSÃO:** O comportamento está **ALINHADO** com a regra desejada. ✅

---

## 📋 Detalhamento dos Pontos de Persistência

### 1. Expedição (Conferência e Carregamento)

| Evento de UI | Ação / Função Chamada | Tabela Afetada (Imediato) | Efeito no Pedido? | Comportamento |
| :--- | :--- | :--- | :--- | :--- |
| **Marcar "Carregado"** (Verde) | `handleSetLoaded` | `delivery_route_orders` | ❌ Não altera | Grava apenas status temporário na rota. |
| **Marcar "Parcial"** (Amarelo) | `handleConfirmPartial` | `delivery_route_orders` | ❌ Não altera | Grava status e payload do rascunho (itens carregados/motivo). |
| **Marcar "Não Carregado"** (Vermelho) | `handleConfirmNotLoaded` | `delivery_route_orders` | ❌ Não altera | Grava status e payload do rascunho (motivo). |
| **Editar Volumes** | `handleVolumeChange` | `delivery_route_orders` | ❌ Não altera | Grava a quantidade de volumes na rota. |
| **Botão "INICIAR ROTA"** | `POST /api/expedition/start-route` | **Múltiplas** | ✅ ALTERA | - Altera status para 'Em Rota'<br>- Cria Pedidos Complementares (Parciais)<br>- Devolve para Sandbox (Não Carregados)<br>- Move rota para histórico |

### 2. Retorno (Baixa e Ocorrências)

| Evento de UI | Ação / Função Chamada | Tabela Afetada (Imediato) | Efeito no Pedido? | Comportamento |
| :--- | :--- | :--- | :--- | :--- |
| **Modal "Entregue"** | `handleDeliveredConfirm` | `delivery_route_orders` | ❌ Não altera | Grava intenção de entrega (outcome='ENTREGUE'). |
| **Modal "Não Entregue"** | `handleNotDeliveredConfirm` | `delivery_route_orders` | ❌ Não altera | Grava motivo e flags de ação no rascunho. |
| **Modal "Devolução Parcial"** | `handlePartialReturnConfirm` | `delivery_route_orders` | ❌ Não altera | Grava itens devolvidos e flags de ação no rascunho. |
| **Botão "FINALIZAR RETORNO"** | `POST /api/expedition/finish-return` | **Múltiplas** | ✅ ALTERA | - Baixa Estoque (se aplicável)<br>- Gera Financeiro (se aplicável)<br>- Gera Devoluções/Trocas<br>- Move para Histórico e libera Rota |

---

## ⚙️ Estrutura Técnica

O sistema utiliza a tabela `delivery_route_orders` como área de *staging* (palco/rascunho).

**Campos utilizados para rascunho:**
- `loading_status`: (pending, loaded, partial, not_loaded)
- `partial_payload`: JSONB contendo detalhes do carregamento parcial ou motivo de não carregamento.
- `return_outcome_type`: (ENTREGUE, NAO_ENTREGUE, DEVOLVIDO_PARCIAL)
- `return_payload`: JSONB contendo motivos, observações e flags de ação (ex: `createComplement`, `reverse_stock`).

Esta arquitetura é robusta pois separa o "estado da conferência" do "estado do pedido", permitindo que o conferente mude de ideia quantas vezes quiser antes de efetivar a operação.
