#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${1:-${REPO_ROOT}}"
BASE_URL="${2:-http://127.0.0.1:3000}"
MODE="${3:-prod}"
REQ_5="${4:-100}"
CONC_5="${5:-5}"
REQ_20="${6:-200}"
CONC_20="${7:-20}"

cd "${REPO_ROOT}"

echo "==> Gate de go-live"
echo "APP_DIR=${APP_DIR}"
echo "BASE_URL=${BASE_URL}"
echo "MODE=${MODE}"

echo "==> 1) Preflight"
bash scripts/preflight-prod.sh "${APP_DIR}"

echo "==> 2) Smoke técnico"
bash scripts/smoke-prod.sh "${BASE_URL}" "${MODE}"

echo "==> 3) Smoke de negócio"
bash scripts/smoke-business.sh "${BASE_URL}" "${MODE}"

echo "==> 4) Relatório consolidado"
bash scripts/go-live-report.sh "${BASE_URL}" "${MODE}" "${REQ_5}" "${CONC_5}" "${REQ_20}" "${CONC_20}"

echo "SUCESSO: gate de go-live aprovado."
