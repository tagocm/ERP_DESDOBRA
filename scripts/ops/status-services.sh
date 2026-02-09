#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

require_cmd systemctl

info "Status do servico web"
sudo systemctl status "${WEB_SERVICE}" --no-pager
echo
info "Status do servico worker"
sudo systemctl status "${WORKER_SERVICE}" --no-pager
