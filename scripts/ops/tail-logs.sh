#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

require_cmd journalctl

LINES="${1:-200}"

info "Logs web (${WEB_SERVICE})"
sudo journalctl -u "${WEB_SERVICE}" -n "${LINES}" --no-pager
echo
info "Logs worker (${WORKER_SERVICE})"
sudo journalctl -u "${WORKER_SERVICE}" -n "${LINES}" --no-pager
