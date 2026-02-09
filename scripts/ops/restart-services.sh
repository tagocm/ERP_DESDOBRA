#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

require_cmd systemctl

info "Reiniciando servicos ${WEB_SERVICE} e ${WORKER_SERVICE}"
sudo systemctl restart "${WEB_SERVICE}" "${WORKER_SERVICE}"
sudo systemctl status "${WEB_SERVICE}" --no-pager
sudo systemctl status "${WORKER_SERVICE}" --no-pager
