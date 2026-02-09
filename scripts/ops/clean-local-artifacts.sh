#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TARGET_DIR="${REPO_ROOT}/artifacts/local-logs"

mkdir -p "${TARGET_DIR}"
shopt -s nullglob

for file in "${REPO_ROOT}"/lint_output.txt "${REPO_ROOT}"/test_*.txt; do
  [[ -e "${file}" ]] || continue
  mv "${file}" "${TARGET_DIR}/"
done

echo "OK: artefatos locais movidos para ${TARGET_DIR}"
