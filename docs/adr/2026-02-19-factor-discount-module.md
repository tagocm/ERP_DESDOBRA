# ADR 2026-02-19 — Financeiro: Desconto de Duplicatas (Factor)

## Status
Proposto (design congelado do Passo 1)

## Contexto
O ERP já possui:
- pré-lançamentos em `financial_events`/`financial_event_installments`
- títulos oficiais em `ar_titles`/`ar_installments` e `ap_titles`/`ap_installments`
- pagamentos/alocações (`ar_payments`, `ap_payments`)
- trilha de auditoria em `audit_logs`
- storage multi-tenant em bucket `company-assets` com path por empresa

Necessidade: implementar fluxo completo de desconto de duplicatas com factor:
`RASCUNHO -> ENVIADA_A_FACTOR -> EM_AJUSTE -> CONCLUIDA | CANCELADA`.

## Decisão
Criar um módulo próprio em camadas (`domain/services/repositories/ui`) com tabelas dedicadas para operação de factor, mantendo integração com AR/AP já existentes apenas na conclusão.

### Entidades principais
1. **Factor**
   - Cadastro da instituição de fomento (taxas, juros, configuração padrão)
2. **FactorOperation**
   - Cabeçalho da operação por empresa e factor
3. **FactorOperationItem**
   - Itens da operação por parcela de AR (desconto/recompra/alteração de vencimento)
4. **FactorOperationVersion**
   - Snapshot de “pacote” V1, V2, ... (congelamento de envio)
5. **FactorOperationResponse**
   - Retorno da factor por item (aceito/recusado/ajustado)
6. **FactorOperationAttachment**
   - Metadados de documentos no storage (relatórios/zip/anexos/retorno)
7. **FactorOperationPosting**
   - Vínculo rastreável e idempotente de lançamentos criados na conclusão

### Status e transições
- `draft` -> `sent_to_factor` (após congelar versão)
- `sent_to_factor` -> `in_adjustment` (quando existe divergência/ajuste no retorno)
- `sent_to_factor` -> `completed` (retorno aderente + concluir)
- `in_adjustment` -> `sent_to_factor` (reenvio de nova versão)
- `in_adjustment` -> `completed`
- `draft` -> `cancelled`
- `sent_to_factor` -> `cancelled` (somente sem conclusão)

Transições inválidas bloqueadas por state machine explícita no domínio.

### Tipos de item
- `DISCOUNT`
- `BUYBACK`
- `DUE_DATE_CHANGE`

Regras mínimas:
- `DISCOUNT`: parcela deve estar em aberto (não liquidada) e fora de custody de factor
- `BUYBACK`: somente parcela atualmente marcada como `with_factor`
- `DUE_DATE_CHANGE`: somente parcela com `with_factor`

### Eventos/auditoria mínimos (audit_logs)
Registrar com `entity='factor_operation'` e `entity_type` específico:
- criação/edição de operação
- criação de versão de pacote
- envio à factor
- importação/aplicação de retorno
- alterações manuais em ajuste
- conclusão/cancelamento
- criação de lançamentos financeiros vinculados

### Lançamentos financeiros (somente na conclusão)
Sem pré-postagem automática durante rascunho/envio.

Na conclusão:
1. **Descontos aceitos**
   - baixam AR original (pagamento/alocação nas parcelas alvo)
   - parcelas marcadas como `with_factor` (rastreamento de custody)
2. **Custos/juros/taxas da factor**
   - geram título AP (despesa com factor)
3. **Recompra aceita**
   - reabre/ajusta AR da parcela recomprada e gera AP correspondente da recompra
4. **Alteração de vencimento aceita**
   - atualiza vencimento da parcela + histórico

Todas as postagens com idempotência por `operation_id + posting_type`.

## Consequências
- Módulo fica desacoplado do fluxo legado de pré-aprovação
- rastreabilidade ponta a ponta (operação -> versão -> item -> retorno -> lançamentos)
- exige novas migrations + RLS + tipos TS regenerados

## Assunções (mínimas)
- fonte de títulos elegíveis: `ar_installments` vinculadas a `ar_titles`
- documentos fiscais para pacote: NF-e autorizada mais recente do pedido (quando houver)
- bucket para anexos: `company-assets`, prefixo `companies/{companyId}/factor/...`

## Fora do escopo inicial
- integração EDI específica por banco/factor
- conciliação bancária automática externa
- fluxo multi-moeda
