#!/usr/bin/env bash
set -u

BASE_URL="${1:-http://127.0.0.1:3000}"
MODE="${2:-prod}"
REQ_5="${3:-100}"
CONC_5="${4:-5}"
REQ_20="${5:-200}"
CONC_20="${6:-20}"

REPORT_DIR="reports"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${REPORT_DIR}/go-live-${TIMESTAMP}.md"

mkdir -p "${REPORT_DIR}"

overall_status="PASS"

write_header() {
  cat > "${REPORT_FILE}" <<EOF
# Go-Live Report

- Timestamp: ${TIMESTAMP}
- Base URL: ${BASE_URL}
- Mode: ${MODE}
- Host: $(hostname)
- User: $(whoami)

## Results
EOF
}

run_and_capture() {
  local title="$1"
  shift
  local cmd=("$@")

  local output
  output="$("${cmd[@]}" 2>&1)"
  local status=$?

  {
    echo ""
    echo "### ${title}"
    echo ""
    echo "- Command: \`${cmd[*]}\`"
    echo "- Exit code: ${status}"
    echo ""
    echo '```text'
    echo "${output}"
    echo '```'
  } >> "${REPORT_FILE}"

  if [[ "${status}" -ne 0 ]]; then
    overall_status="FAIL"
  fi

  return 0
}

write_header

run_and_capture "Smoke Test" bash scripts/smoke-prod.sh "${BASE_URL}" "${MODE}"
run_and_capture "Load Test (5 concurrent)" bash scripts/load-health.sh "${BASE_URL}" "${REQ_5}" "${CONC_5}"
run_and_capture "Load Test (20 concurrent)" bash scripts/load-health.sh "${BASE_URL}" "${REQ_20}" "${CONC_20}"

{
  echo ""
  echo "## Final Status"
  echo ""
  echo "- Status: **${overall_status}**"
} >> "${REPORT_FILE}"

echo "Relatorio gerado em: ${REPORT_FILE}"
if [[ "${overall_status}" != "PASS" ]]; then
  echo "GO-LIVE BLOQUEADO: um ou mais testes falharam."
  exit 1
fi

echo "GO-LIVE APROVADO: todos os testes passaram."
