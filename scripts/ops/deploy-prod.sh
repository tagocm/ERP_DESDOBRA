#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

RELEASE_REF="${1:-}"

require_cmd git
require_cmd npm
require_cmd systemctl
require_cmd curl

cd "${APP_DIR}"
load_env_file

if [[ -n "${RELEASE_REF}" ]]; then
  info "Trocando para release ${RELEASE_REF}"
  git fetch --all --tags
  git checkout "${RELEASE_REF}"
fi

info "Rodando preflight de producao"
bash scripts/preflight-prod.sh "${APP_DIR}"

info "Reiniciando servicos"
sudo systemctl restart "${WEB_SERVICE}" "${WORKER_SERVICE}"

info "Health check"
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

info "Deploy concluido com sucesso."
