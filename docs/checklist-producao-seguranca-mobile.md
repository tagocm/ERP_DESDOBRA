# Checklist: Produção, Segurança e Mobile

> Objetivo: deixar o Desdobra pronto para produção **sem travar o desenvolvimento** (hardening incremental, budgets e flags).

## Checklist (marcável)

### Segurança
- [x] Em produção, APIs **não retornam** `details`/stacktrace (apenas `message` + `code`)
- [x] `console.*` removido de rotas/actions (usar `logger` com redaction)
- [x] Rate limit aplicado em rotas públicas (dev alto / prod baixo)
- [x] Headers de segurança ativos em produção (CSP mínima, `frame-ancestors`, etc.)
- [x] Rotas `/api/debug/*` e `/api/test/*` bloqueadas em produção sem token

### Multi-tenant / RLS
- [ ] Checklist “toda query por empresa” (sempre `company_id`)
- [ ] RLS habilitado em 100% das tabelas de negócio
- [ ] Teste negativo: tenant A não lê/edita tenant B

### Mobile
- [x] Ingestão idempotente (unique `event_id` + insert atômico)
- [x] Token por dispositivo com revogação/expiração + `last_used_at`
- [ ] Processor assíncrono com retries e status (`received/processed/error`)
- [ ] Tela admin para tokens e fila de eventos
- [x] Eventos viram `financial_events` (pré-aprovação) sem bypass perigoso

### CI/DB
- [ ] CI sempre verde: lint + typecheck + unit + build + e2e
- [ ] E2E roda em ambiente previsível (sem drift manual)
- [x] Check automático: migration duplicada / fora de ordem
- [ ] Check automático: RLS faltando (auditoria)

### Qualidade / Organização
- [ ] Budgets para warnings (não regredir)
- [ ] Plano de redução de warnings por sprint (top arquivos)

## 0) Critérios de “pronto para produção”
- [ ] CI verde (lint/typecheck/unit/e2e) com ambiente previsível
- [ ] Logs sem dados sensíveis (XML, tokens, senhas, payloads)
- [ ] Multi-tenant garantido por RLS + checagens server-side (sem confiar em `companyId` do client)
- [ ] Rotação/gestão de segredos e rotas internas protegidas
- [ ] Observabilidade mínima (erros + métricas básicas) e runbook

## 1) Segurança (P0/P1)
### P0 — feito
- [x] DANFE: evitar vazamento multi-tenant ao buscar `company_settings.logo_path` por `company_id`
- [x] NF-e: remover logs/respostas com XML/trechos sensíveis (usar redaction/flags)
- [x] Certificado A1: remover logs sensíveis + rate limit + erros seguros
- [x] Rate limit em rotas críticas (mobile + NF-e + certificado)
- [x] Erros em produção sem `details` por padrão (flag `EXPOSE_ERROR_DETAILS=true` para debug)
- [x] Headers de segurança (prod por padrão; dev via flag)

### P1 — em andamento
- [x] Auditar `app/api/**` e `app/actions/**` para remover `console.*` e padronizar logs com `logger`
- [ ] Revisar rotas de debug/test e garantir `INTERNAL_API_TOKEN` em produção
- [ ] Revisar policies permissivas (ex.: políticas com `USING (true)` em tabelas sensíveis)
- [ ] `npm audit`: resolver vulnerabilidades (priorizar high) sem quebrar build

## 2) Multi-tenant (não confiar no client)
### Feito
- [x] Rotas que antes aceitavam `companyId` do client agora usam empresa ativa do usuário (403 se mismatch):
  - `/api/orgs` (GET/POST)
  - `/api/orgs/[id]` (GET/PATCH/DELETE)
  - `/api/inventory/purchase-in` (POST)
  - `/api/work-orders/[id]/finish` (POST)

### Próximos passos
- [ ] Mapear todas as rotas/actions que recebem `companyId` e migrar para `getActiveCompanyId()`
- [ ] Onde precisar de “multi-company”, implementar seletor + allowlist explícita (nunca via input livre)

## 3) Mobile (inbox → lançamentos financeiros)
### Ingestion (feito)
- [x] Endpoint `POST /api/mobile/sync` com token `mb_` (hash SHA-256 no banco)
- [x] Zod validation + payload v1/v2 + sem vazar detalhes em produção
- [x] Idempotência: `event_id` único + tratamento de `23505` (duplicate)
- [x] Tabelas `mobile_expense_events` e `mobile_api_tokens` com RLS (service_role escreve; admin lê)

### Processor (feito)
- [x] Processor idempotente: `mobile_expense_events(status=received)` → `financial_events` + 1 parcela
- [x] Script local: `scripts/mobile/process-expenses.ts`
- [x] Endpoint interno: `POST /api/internal/mobile/process` (token)

### Próximos passos (não travam dev)
- [ ] Rodar processor de forma agendada (cron/worker) e registrar métricas (processed/errors)
- [ ] Definir estratégia de “categoria/conta” no mobile v2 (mapeamento por `*_code`)
- [ ] Anexos: desenho completo de receipts (upload + storage + RLS + antivírus opcional)
- [ ] Reprocessamento: botão/rota interna para “retry” de eventos em `status=error`

## 4) Qualidade (sem bloquear)
### Feito
- [x] Budget anti-regressão de `any` em `app/actions` (CI)
- [x] Report geral de `any` (não bloqueante): `node scripts/any-report.js`

### Próximos passos
- [ ] Orçar budgets por área (ex.: `app/api`, `lib/finance`) e reduzir por sprint
- [ ] Migrar APIs para tipos do Supabase (`types/supabase.ts`) e remover `as any` por hotspots

## 5) CI / E2E (estabilizar)
- [x] Check de migrations no CI: `node scripts/check-migrations.js`
- [ ] Garantir que o Supabase remoto usado no CI tenha migrations aplicadas e grants corretos
- [ ] Tornar E2E determinístico: seed isolado por run + limpeza + usuários/empresas fixos de teste
- [ ] Separar “checks bloqueantes” vs “informativos” (ex.: warnings de lint não bloqueiam)

## 6) Operação
- [ ] Configurar rastreamento de erros (Sentry ou equivalente) + alertas
- [ ] Healthcheck interno (DB + storage) e runbook de incidentes
- [ ] Política de backup/restore (Supabase) e teste periódico
- [ ] Rotação de segredos (`SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_TOKEN`)

## Referências
- Flags e rotas internas: `docs/flags-and-internal-apis.md`
