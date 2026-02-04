# Checklist: Nota 9 (Produção)

> Objetivo: levar o Desdobra de “quase pronto” para **padrão produção nota 9**, sem travar o desenvolvimento (mudanças incrementais, com budgets e flags).

## 0) Definição de pronto (nota 9)
- [ ] **Multi-tenant garantido**: RLS em 100% das tabelas de negócio + teste negativo (tenant A não lê/edita tenant B)
- [ ] **Sem bypass perigoso**: ações de usuário não dependem de `SUPABASE_SERVICE_ROLE_KEY` (ou, quando inevitável, via RPC/queue com checagem forte e escopo mínimo)
- [ ] **Sem vazamento em logs/respostas**: nada de XML, tokens, payloads sensíveis, senhas, PII em logs de produção
- [ ] **CI verde e previsível**: lint + typecheck + unit + build + e2e (sem drift manual)
- [ ] **Dependências ok**: vulnerabilidades high corrigidas/mitigadas (com plano documentado)
- [ ] **Operação mínima**: healthcheck, rastreamento de erro, backups/restore e runbook

## 1) Multi-tenant / RLS (maior impacto)
- [x] Auditoria automática: listar tabelas sem RLS + policies “abertas” (ex.: `USING (true)`) e report por PR
  - Implementado: `node scripts/check-rls-static.js` (warning; modo estrito via `--strict` ou `CI_STRICT_RLS=true`)
- [x] Check em CI (começar como warning; virar bloqueante quando estabilizar)
  - Implementado: `node scripts/check-rls-static.js` (warning; modo estrito via `--strict` ou `CI_STRICT_RLS=true`)
- [x] Fechar policies permissivas em logs/parcelas (sem `USING/WITH CHECK (true)` para authenticated)
  - Implementado: `supabase/migrations/20260204193000_harden_occurrence_logs_and_installments_rls.sql`
- [ ] “Company context” padronizado em **todas** as rotas/actions (sempre derivado do server: `getActiveCompanyId()` / `resolveCompanyContext()`)
- [ ] Varredura de código: todo `.from('…')` de tabela de negócio deve ter filtro por `company_id` (ou estar protegido por view/RLS)
- [ ] Teste negativo automatizado (Playwright ou unit/integration): tenant A não acessa recursos do tenant B

## 2) Service role / privilégios
- [x] Auditoria automática (CI): apontar uso de `SUPABASE_SERVICE_ROLE_KEY`/`createAdminClient()` em `app/api/**` e `app/actions/**` (warning)
  - Implementado: `node scripts/check-service-role-usage.js` (warning; modo estrito via `--strict` ou `CI_STRICT_SERVICE_ROLE=true`)
- [ ] Remover `SUPABASE_SERVICE_ROLE_KEY` de fluxos de usuário (ex.: `app/actions/save-sales-order.ts`)
- [ ] Onde precisar privilégio: mover para **RPC security definer** ou **fila interna** com validação de `auth.uid()` + `company_id`
- [ ] Revisar `createAdminClient()` usages: só em rotas internas/worker/processor, nunca em request de usuário sem validação forte

## 3) Logs, erros e privacidade
- [ ] Remover/ocultar `console.*` de `lib/**` (trocar por `logger` e colocar debug atrás de flag)
  - Progresso (04/02/2026): removido `console.*` de `lib/data/sales-orders.ts`, `lib/sefaz/consultaCadastro.ts`, `lib/danfe/danfeParser.ts`, `lib/fiscal/nfe-emission-actions.ts`
- [ ] Redaction central (tokens, chaves, XML, documentos): helper único + checklist de campos proibidos
- [ ] Erros consistentes nas APIs (preferir `errorResponse()`/shape padronizado) e sem detalhes em produção
- [ ] `request_id`/correlation id em logs e respostas (ajuda muito suporte/produção)

## 4) Mobile (app → eventos financeiros)
- [ ] Processor assíncrono com retries/backoff e status (`received/processing/processed/error`) + `error_code`
- [ ] Rotina agendada (cron/worker) com métricas: processed/min, error rate, fila pendente
- [ ] Tela admin: tokens (criar/revogar) + fila de eventos (reprocessar/inspecionar)
- [ ] Contrato de payload versionado + testes de compatibilidade (v1/v2) + validação robusta

## 5) CI/CD e E2E
- [ ] E2E determinístico: seed isolado por run + cleanup + usuários/empresas de teste
- [x] Pipeline separando “bloqueante” vs “informativo” (budgets bloqueantes; audits informativos)
- [ ] Checks adicionais: RLS audit, service-role audit, segredo/PII audit (regex/gitleaks-like)

## 6) Qualidade / padronização (sem travar)
- [x] Visibilidade em CI: relatório de `any` por área (`node scripts/any-report.js`)
- [ ] Budget de `any` por área (começar por `app/api`, `lib/finance`) sem regressão
- [ ] Budget de warnings por área (reduzir por sprint; não aumentar)
- [ ] Plano de redução (top 10 arquivos por warnings/any) com metas semanais pequenas
- [ ] Padronizar validação de payload (Zod) nas rotas críticas

## 7) Operação (mínimo para produção)
- [x] Healthcheck interno (DB + storage) protegido por `INTERNAL_API_TOKEN` (`GET /api/internal/health`)
- [ ] Error tracking (Sentry ou equivalente) + alertas básicos
- [ ] Política de backup/restore (Supabase) + teste periódico
- [ ] Rotação de segredos (service role, internal token) + checklist de incident response
