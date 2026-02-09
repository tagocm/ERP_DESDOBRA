#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/erp-desdobra}"
ENV_FILE="${ENV_FILE:-/etc/erp-desdobra/env}"
WEB_SERVICE="${WEB_SERVICE:-erp-desdobra-web}"
WORKER_SERVICE="${WORKER_SERVICE:-erp-desdobra-worker}"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatorio nao encontrado: $1"
}

load_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  else
    warn "Arquivo de env nao encontrado em ${ENV_FILE} (continuando sem source)."
  fi
}

