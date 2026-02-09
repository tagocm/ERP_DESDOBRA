#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_common.sh"

require_cmd npx

cd "${APP_DIR}"
load_env_file

info "Aplicando migrations no projeto Supabase linkado"
npx supabase db push

info "Migrations aplicadas."
