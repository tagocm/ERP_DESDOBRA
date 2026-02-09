#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

require_cmd systemctl
require_cmd cp

cd "${APP_DIR}"

[[ -f "deploy/systemd/${WEB_SERVICE}.service" ]] || fail "Arquivo ausente: deploy/systemd/${WEB_SERVICE}.service"
[[ -f "deploy/systemd/${WORKER_SERVICE}.service" ]] || fail "Arquivo ausente: deploy/systemd/${WORKER_SERVICE}.service"

info "Instalando units systemd"
sudo cp "deploy/systemd/${WEB_SERVICE}.service" /etc/systemd/system/
sudo cp "deploy/systemd/${WORKER_SERVICE}.service" /etc/systemd/system/
sudo systemctl daemon-reload

info "Habilitando servicos no boot"
sudo systemctl enable "${WEB_SERVICE}" "${WORKER_SERVICE}"

info "Concluido. Use scripts/ops/restart-services.sh para subir os servicos."
