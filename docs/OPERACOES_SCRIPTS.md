# Scripts de Operacao (Produção)

## Pré-go-live

- `npm run preflight:prod -- /opt/erp-desdobra`
  - Valida env crítico, bloqueia flags de debug, roda `npm ci`, `typecheck`, `lint`, testes e build.
- `npm run smoke:prod -- http://127.0.0.1:3000 prod`
  - Sanidade técnica do app (health, login, proteção de rotas internas/debug).
- `npm run smoke:business -- http://127.0.0.1:3000 prod`
  - Sanidade de fluxo de negócio (seed de pedido, status do pedido e entrega teste).
  - Em produção exige `INTERNAL_API_TOKEN` e `SESSION_COOKIE`.
- `npm run load:health -- http://127.0.0.1:3000 200 20`
  - Carga rápida em `/api/health` com controle de concorrência.
- `npm run go-live:report -- http://127.0.0.1:3000 prod 100 5 200 20`
  - Consolida smoke + carga em `reports/go-live-<timestamp>.md`.

## Operação diária (systemd)

- `npm run ops:status`
  - Mostra status de `erp-desdobra-web` e `erp-desdobra-worker`.
- `npm run ops:logs -- 300`
  - Exibe os últimos logs dos dois serviços (padrão: 200 linhas).
- `npm run ops:restart`
  - Reinicia serviços web + worker.
- `npm run ops:clean-local`
  - Move `lint_output.txt` e `test_*.txt` do root para `artifacts/local-logs`.

## Deploy e rollback

- `npm run ops:install-systemd`
  - Instala units em `/etc/systemd/system` e habilita no boot.
- `npm run ops:deploy -- <tag-ou-commit>`
  - Opcionalmente troca versão, executa preflight, reinicia serviços e valida health.
- `npm run ops:rollback -- <tag-ou-commit>`
  - Faz checkout da versão alvo, executa `npm ci` + build, reinicia e valida health.
- `npm run ops:migrate`
  - Executa `npx supabase db push` com env carregado de `/etc/erp-desdobra/env`.
- `npm run ops:go-live-gate -- /opt/erp-desdobra http://127.0.0.1:3000 prod 100 5 200 20`
  - Roda preflight + smoke técnico + smoke negócio + relatório consolidado em uma única execução.

## Variáveis de ambiente de operação

- `APP_DIR` (default: `/opt/erp-desdobra`)
- `ENV_FILE` (default: `/etc/erp-desdobra/env`)
- `WEB_SERVICE` (default: `erp-desdobra-web`)
- `WORKER_SERVICE` (default: `erp-desdobra-worker`)

## Organização de scripts

- Scripts oficiais de operação: `scripts/ops/` e checks de produção no root de `scripts/`.
- Scripts técnicos históricos/ad-hoc: `scripts/legacy/`.
