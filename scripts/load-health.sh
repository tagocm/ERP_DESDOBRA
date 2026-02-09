#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
TOTAL_REQUESTS="${2:-200}"
CONCURRENCY="${3:-20}"

if ! [[ "${TOTAL_REQUESTS}" =~ ^[0-9]+$ ]] || ! [[ "${CONCURRENCY}" =~ ^[0-9]+$ ]]; then
  echo "Uso: $0 [base_url] [total_requests] [concurrency]"
  exit 1
fi

if [[ "${TOTAL_REQUESTS}" -lt 1 || "${CONCURRENCY}" -lt 1 ]]; then
  echo "ERRO: total_requests e concurrency precisam ser >= 1"
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "${tmp_file}"' EXIT

echo "==> Load test /api/health"
echo "Base URL: ${BASE_URL}"
echo "Requests: ${TOTAL_REQUESTS}"
echo "Concurrency: ${CONCURRENCY}"

run_one() {
  curl -s -o /dev/null -w "%{http_code},%{time_total}\n" "${BASE_URL}/api/health"
}

export BASE_URL
export -f run_one

seq "${TOTAL_REQUESTS}" | xargs -I{} -P "${CONCURRENCY}" bash -lc 'run_one' >> "${tmp_file}"

success_count="$(awk -F',' '$1 == 200 {c++} END {print c+0}' "${tmp_file}")"
error_count="$((TOTAL_REQUESTS - success_count))"

avg_ms="$(awk -F',' '{sum += ($2 * 1000)} END {if (NR>0) printf "%.2f", sum/NR; else print "0"}' "${tmp_file}")"

p95_ms="$(
  awk -F',' '{print $2 * 1000}' "${tmp_file}" | sort -n | awk '
    {a[NR]=$1}
    END {
      if (NR==0) {print "0.00"; exit}
      idx=int((95*NR + 99)/100)
      if (idx < 1) idx=1
      if (idx > NR) idx=NR
      printf "%.2f", a[idx]
    }
  '
)"

echo "==> Resultado"
echo "Success 200: ${success_count}/${TOTAL_REQUESTS}"
echo "Errors: ${error_count}/${TOTAL_REQUESTS}"
echo "Avg latency (ms): ${avg_ms}"
echo "P95 latency (ms): ${p95_ms}"

if [[ "${error_count}" -gt 0 ]]; then
  echo "FALHA: houve erros HTTP no load test."
  exit 1
fi

echo "SUCESSO: load test basico concluido sem erros."
