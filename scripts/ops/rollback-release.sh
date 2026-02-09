#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

TARGET_REF="${1:-}"
[[ -n "${TARGET_REF}" ]] || fail "Uso: $0 <tag-ou-commit>"

require_cmd git
require_cmd npm
require_cmd systemctl
require_cmd curl

cd "${APP_DIR}"
load_env_file

info "Rollback para ${TARGET_REF}"
git fetch --all --tags
git checkout "${TARGET_REF}"

info "Reinstalando dependencias e build"
npm ci
npm run build:prod

info "Reiniciando servicos"
sudo systemctl restart "${WEB_SERVICE}" "${WORKER_SERVICE}"

info "Health check"
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

info "Rollback concluido com sucesso."
