# Scripts Overview

Este repositório possui muitos scripts históricos de diagnóstico e correção.
Para operação de produção, trate como oficiais apenas os comandos abaixo:

- `scripts/preflight-prod.sh`
- `scripts/smoke-prod.sh`
- `scripts/smoke-business.sh`
- `scripts/load-health.sh`
- `scripts/go-live-report.sh`
- `scripts/ops/*.sh`

Referência operacional:

- `docs/OPERACOES_SCRIPTS.md`

Regra prática:

- Se o script não estiver no guia de operações, considere script técnico de manutenção/diagnóstico.
- Scripts históricos e ad-hoc foram concentrados em `scripts/legacy/`.
