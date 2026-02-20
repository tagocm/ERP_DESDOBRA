# Módulo Técnico — Financeiro / Desconto de Duplicatas (Factor)

## Objetivo
Controlar o ciclo completo de desconto de duplicatas com factor, com rastreabilidade ponta a ponta:

`Rascunho -> Enviada à Factor -> Em Ajuste -> Concluída | Cancelada`

## Escopo Implementado
- Cadastro de factors e parâmetros padrão de custos.
- Operações com montagem de pacote por item.
- Versionamento de pacotes (V1, V2, ...).
- Registro de retorno por item (aceito/recusado/ajustado).
- Conclusão com geração de lançamentos financeiros rastreáveis.
- Idempotência na conclusão (não duplica lançamentos).
- Auditoria de ações em `audit_logs`.

## Rotas UI
- `/app/financeiro/desconto-duplicatas`
- `/app/financeiro/desconto-duplicatas/[id]`
- `/app/financeiro/desconto-duplicatas/titulos-na-factor`

## Rotas API
- `GET/POST /api/finance/factor/factors`
- `GET/POST /api/finance/factor/operations`
- `GET/PATCH /api/finance/factor/operations/[id]`
- `POST /api/finance/factor/operations/[id]/items`
- `DELETE /api/finance/factor/operations/[id]/items/[itemId]`
- `POST /api/finance/factor/operations/[id]/versions`
- `POST /api/finance/factor/operations/[id]/send`
- `POST /api/finance/factor/operations/[id]/responses`
- `POST /api/finance/factor/operations/[id]/conclude`
- `POST /api/finance/factor/operations/[id]/cancel`
- `POST /api/finance/factor/operations/[id]/downloads/package-zip`
- `GET /api/finance/factor/installments/open`
- `GET /api/finance/factor/installments/with-factor`

## Banco de Dados
Migração principal:
- `supabase/migrations/20260219130000_create_factor_discount_module.sql`

Entidades:
- `factors`
- `factor_operations`
- `factor_operation_items`
- `factor_operation_versions`
- `factor_operation_responses`
- `factor_operation_attachments`
- `factor_operation_postings`

## Segurança / Tenancy
- Todas as tabelas novas usam `company_id`.
- RLS habilitado e políticas `is_member_of(company_id)`.
- Triggers de consistência impedem relacionamentos cross-company.

## Regras-Chave
- Somente operações em `draft`/`in_adjustment` aceitam edição de itens.
- `buyback` só é permitido para título em custody de factor.
- `due_date_change` exige data proposta.
- Conclusão exige retorno para todos os itens.
- Se operação já estiver `completed`, conclusão retorna idempotente.

## Testes do Módulo
Unit e fluxo:
- `lib/domain/factor/__tests__/costs.test.ts`
- `lib/domain/factor/__tests__/state-machine.test.ts`
- `lib/domain/factor/__tests__/validations.test.ts`
- `lib/services/factor/__tests__/factor-service-flow.test.ts`

Comando:
```bash
npm run test:run -- lib/domain/factor/__tests__/costs.test.ts lib/domain/factor/__tests__/state-machine.test.ts lib/domain/factor/__tests__/validations.test.ts lib/services/factor/__tests__/factor-service-flow.test.ts
```
