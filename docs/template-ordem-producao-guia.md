# Template de Ordem de Produção (A4) - Guia de Campos e Lançamento

## Objetivo
Padronizar um documento de **Ordem de Produção (OP)** com layout similar ao template de pedidos, para uso operacional em chão de fábrica e rastreabilidade entre setores.

Este documento define:
- campos obrigatórios e recomendados;
- estrutura visual do template;
- regra de preenchimento por setor;
- plano de lançamento futuro com comunicação ao time de produção.

## Referência de layout
Base visual usada: template de pedidos A4 em [order-a4.ts](/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/lib/templates/print/order-a4.ts).

Template criado para OP: [work-order-a4.ts](/Users/tago/Projects/MARTIGRAN/APPS/ERP_DESDOBRA/lib/templates/print/work-order-a4.ts).

## Escopo funcional do template OP
1. Cabeçalho da empresa + identificação da OP.
2. Resumo operacional (produto, setor, status, datas, FT).
3. Quadro de instruções da OP.
4. Tabela de insumos (previsto x consumido, lote e validade).
5. Checklist de execução por setor.
6. OPs vinculadas (filhas/dependências).
7. Assinaturas de produção, qualidade e supervisão.

## Análise de campos necessários

### Bloco 1 - Identificação da OP (obrigatório)
- `work_orders.document_number`
- `work_orders.id`
- `work_orders.created_at`
- `work_orders.status`
- `work_orders.scheduled_date`
- `work_orders.started_at`
- `work_orders.finished_at`
- `production_sectors.code`, `production_sectors.name` (via `work_orders.sector_id`)

### Bloco 2 - Produto e meta de produção (obrigatório)
- `items.name`, `items.sku`, `items.uom` (via `work_orders.item_id`)
- `work_orders.planned_qty`
- `work_orders.produced_qty`
- `bom_headers.version`, `bom_headers.yield_qty`, `bom_headers.yield_uom` (via `work_orders.bom_id`)

### Bloco 3 - Instruções e contexto (obrigatório)
- `work_orders.notes`
- referência de OP mãe: `work_orders.parent_work_order_id` e `work_orders.document_number` da mãe

### Bloco 4 - Insumos para execução (obrigatório para operação)
- previsto: `bom_lines.component_item_id`, `bom_lines.qty`, `bom_lines.uom`
- descrição insumo: `items.name`, `items.sku`
- consumo real (quando houver): `work_order_consumptions.component_item_id`, `work_order_consumptions.qty`, `work_order_consumptions.uom`
- lote/validade: campo operacional manual no template (até existir captura estruturada completa por lote no apontamento)

### Bloco 5 - Dependências (recomendado)
- OPs filhas geradas: IDs/números, item, setor, status
- utilidade: coordenação entre Produção base e Envase

### Bloco 6 - Controle por setor (obrigatório de processo)
- setor responsável;
- atividade executada;
- responsável;
- hora início/fim;
- assinatura/rubrica.

## Regras de preenchimento por setor
1. `Almoxarifado`: confirmar separação, lote e validade dos insumos.
2. `Produção`: registrar execução e variações relevantes do processo.
3. `Envase`: registrar envase/pesagem/identificação.
4. `Qualidade`: registrar liberação e observações de conformidade.
5. `PCP/Supervisão`: validação final da ordem e encerramento documental.

## Regras de lançamento futuro (sistema)
1. Impressão/geração PDF de OP deve usar o template A4 de OP.
2. Dados base vêm de `work_orders + items + bom_headers + bom_lines + work_order_consumptions`.
3. Sem dados de consumo real, manter coluna "Consumido" em branco para preenchimento manual.
4. Sem lote estruturado, manter lote/validade em branco para preenchimento manual.
5. OP com dependências deve exibir bloco de OPs vinculadas quando houver filhas.

## Pendências técnicas para go-live
1. Criar endpoint de impressão dedicado (`/api/pcp/work-orders/print`) usando `generatePdfFromHtml`.
2. Incluir ação de impressão no módulo de ordens (`/app/producao/ordens`), substituindo o print HTML inline atual.
3. Validar paginação quando OP tiver muitos insumos.
4. Definir política de retenção/arquivamento do PDF final assinado.

## Notificação para produção (texto sugerido)
**Assunto:** Novo padrão de Ordem de Produção (OP) - lançamento futuro  
**Mensagem:**  
Será lançado um novo template de OP padronizado, com foco em execução por setor e rastreabilidade.  
O documento conterá: identificação da OP, produto/meta, insumos previstos x consumidos, checklist por setor, dependências e assinaturas.  
Objetivo: reduzir dúvidas operacionais, aumentar conformidade e padronizar apontamentos entre Produção, Envase, Qualidade e PCP.  
Antes do lançamento oficial, o time receberá uma orientação rápida de preenchimento.

