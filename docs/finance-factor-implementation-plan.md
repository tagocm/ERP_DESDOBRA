# Financeiro > Desconto de Duplicatas (Factor) — Plano de Implementação (Design Congelado)

## Arquitetura alvo

### Camadas
- `lib/domain/factor/*`
  - schemas zod
  - state machine
  - cálculo/simulação
  - tipos do domínio
- `lib/repositories/factor/*`
  - persistência (Supabase)
  - queries de listagem, detalhes, itens elegíveis, respostas, anexos
- `lib/services/factor/*`
  - orquestração de casos de uso (criar operação, gerar versão, aplicar retorno, concluir)
  - auditoria
  - geração de artefatos (csv/zip)
- `app/api/finance/factor/*`
  - contratos HTTP com validação zod
- `app/actions/factor/*` (se necessário para UI server actions)
- `components/finance/factor/*`
  - lista, filtros, cards KPI
  - detalhe por abas
  - tabelas e formulários
- `app/app/financeiro/desconto-duplicatas/*`
  - páginas/rotas

## Rotas de UI
- `/app/financeiro/desconto-duplicatas`
  - lista de operações (KPIs, filtros, ações)
- `/app/financeiro/desconto-duplicatas/[id]`
  - detalhe da operação com abas:
    1. Montagem do Pacote
    2. Documentos
    3. Retorno da Factor
    4. Prévia de Lançamentos
- `/app/financeiro/desconto-duplicatas/titulos-na-factor` (atalho diário)

## Rotas de API
- `GET/POST /api/finance/factor/operations`
- `GET/PATCH /api/finance/factor/operations/[id]`
- `POST /api/finance/factor/operations/[id]/items`
- `PATCH/DELETE /api/finance/factor/operations/[id]/items/[itemId]`
- `POST /api/finance/factor/operations/[id]/versions`
- `POST /api/finance/factor/operations/[id]/send`
- `POST /api/finance/factor/operations/[id]/responses`
- `POST /api/finance/factor/operations/[id]/conclude`
- `POST /api/finance/factor/operations/[id]/cancel`
- `POST /api/finance/factor/operations/[id]/downloads/package-zip`

## Componentes UI (TRUE GOLD)
- Header padrão (`PageHeader`) + ações principais
- Card de KPIs: total nominal, total custos, líquido estimado, status
- Tabela de operações com badges PT-BR
- Tabela de itens (ação, parcela, vencimento, valor, status de retorno)
- Blocos de estado vazio/erro/carregamento consistentes
- Dialogs para envio, aplicação de retorno e conclusão

## Estratégia de rastreabilidade
- IDs e vínculos explícitos:
  - operação -> versão -> item -> resposta -> posting
- logs em `audit_logs` para cada mudança de estado
- attachments vinculados por `operation_id` e opcionalmente `version_id`

## Estratégia de idempotência
- conclusão protegida por:
  - lock de status (`completed` não processa novamente)
  - tabela `factor_operation_postings` com unicidade por `operation_id + posting_type`

## Segurança
- multi-tenant por `company_id`
- políticas RLS em todas as tabelas novas
- storage path segmentado por `companies/{companyId}/...`

