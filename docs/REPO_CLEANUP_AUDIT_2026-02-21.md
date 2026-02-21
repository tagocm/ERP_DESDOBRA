# Repo Cleanup Audit - 2026-02-21

## Scope
Auditoria de limpeza e organização estrutural do repositório `ERP_DESDOBRA`.

## Snapshot
- Branch: `main`
- Worktree já estava suja antes da auditoria:
  - `app/app/compras/necessidades/needs-client.tsx`
  - `components/organizations/ClientRegistrationModal.tsx`
- Volume atual:
  - `supabase/migrations`: 387 arquivos
  - `scripts`: 207 arquivos (145 na raiz, 42 em `scripts/legacy`)
  - `app`: 218 arquivos
  - `components`: 228 arquivos
  - `lib`: 193 arquivos
  - `tests`: 10 arquivos

## Main Findings

### P0 - Segurança/Operação
1. Endpoints de debug e test expostos no app:
   - `app/api/debug*`
   - `app/api/test/*`
   - `app/debug-routes/page.tsx`
   Risco: superfície operacional indevida em produção.

### P1 - Organização
2. Alta dispersão de scripts ad-hoc na raiz de `scripts/`.
   - Apenas ~20 scripts aparecem diretamente em `package.json`.
   - 145 arquivos na raiz dificultam descoberta e ownership.

3. Inconsistência de naming e duplicidade semântica:
   - `components/expedition` (13 arquivos) vs `components/expedicao` (5 arquivos)
   - `app/actions/finance` vs `app/actions/financial`
   - Scripts duplicados por convenção:
     - `check-schema.ts` e `check_schema.ts`
     - `fix-user-company.ts` e `fix_user_company.ts`

4. Artefato técnico versionado sem valor de runtime:
   - `estrutura.dump` (trackeado no git)

### P2 - Manutenibilidade
5. Alto volume de migrations sem arquivamento por domínio/ciclo.
   - 387 migrations elevam custo de manutenção e revisão.
   - Naming está consistente (timestamp + slug), mas falta governança de ciclo.

6. Presença de muito código legado e TODO/FIXME espalhado.
   - Indica backlog técnico não consolidado e risco de regressão em alterações.

7. Baixa densidade de testes frente ao tamanho do código.
   - 10 arquivos de teste para base relativamente grande.

## Recommended Cleanup Plan

### Fase 1 (rápida, baixo risco)
1. Mover endpoints de debug/test para proteção explícita por ambiente/role.
2. Remover `estrutura.dump` do versionamento e reforçar `.gitignore`.
3. Consolidar convenção de naming para scripts (`kebab-case`).
4. Resolver duplicidades de nome em `scripts` (manter 1 versão canônica).

### Fase 2 (organização estrutural)
5. Reorganizar `scripts/` por domínio:
   - `scripts/db/`, `scripts/fiscal/`, `scripts/ops/`, `scripts/dev/`, `scripts/legacy/`.
6. Criar índice de scripts com owner e propósito em `scripts/README.md`.
7. Unificar estratégia de idioma/namespace para módulos de logística (`expedition` vs `expedicao`).

### Fase 3 (governança contínua)
8. Política de depreciação para scripts legados (TTL + remoção programada).
9. Checklist de PR para impedir novos `debug/test` routes sem guardas.
10. Plano de incremento de testes para áreas críticas (queue, fiscal, logística).

## Suggested KPIs
- Reduzir scripts na raiz de `scripts/` de 145 para <40.
- Reduzir duplicidade nominal em scripts para 0.
- Reduzir TODO/FIXME abertos em 30%.
- Aumentar cobertura de testes em módulos críticos.

## Notes
- Esta auditoria não alterou comportamento de negócio.
- Mudanças funcionais devem ser executadas por fases para evitar regressão operacional.

## Execution Status (2026-02-21)

Aplicado (Fase 1):
- Rotas de debug/test protegidas por `requireInternalApiAccess`:
  - `app/api/debug-rpc-test/route.ts`
- Página de debug bloqueada em produção:
  - `app/debug-routes/page.tsx` (usa `notFound()` em `NODE_ENV=production`)
- Remoção de artefato sem valor de runtime:
  - `estrutura.dump` removido do versionamento
  - `.gitignore` atualizado com `*.dump`
- Consolidação de scripts duplicados:
  - `scripts/check_schema.ts` movido para `scripts/legacy/check_schema.ts`
  - `scripts/fix_user_company.ts` movido para `scripts/legacy/fix_user_company.ts`

Pendente (depende de DB push):
- Aplicar migrations já criadas para lints de segurança:
  - `supabase/migrations/20260220173000_fix_security_definer_views_lint_0010.sql`
  - `supabase/migrations/20260220180000_fix_function_search_path_and_extensions_schema.sql`

Observação:
- O warning `auth_leaked_password_protection` é configuração de projeto no Supabase Auth, não correção por migration.
