#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
MODE="${2:-prod}" # prod|dev

echo "==> Smoke test (${MODE}) em ${BASE_URL}"

request_code() {
  local method="$1"
  local url="$2"
  local header_name="${3:-}"
  local header_value="${4:-}"

  if [[ -n "${header_name}" ]]; then
    curl -s -o /dev/null -w "%{http_code}" -X "${method}" -H "${header_name}: ${header_value}" "${url}"
  else
    curl -s -o /dev/null -w "%{http_code}" -X "${method}" "${url}"
  fi
}

assert_code() {
  local name="$1"
  local actual="$2"
  local expected_csv="$3"

  IFS=',' read -r -a expected <<< "${expected_csv}"
  local ok="0"
  for code in "${expected[@]}"; do
    if [[ "${actual}" == "${code}" ]]; then
      ok="1"
      break
    fi
  done

  if [[ "${ok}" != "1" ]]; then
    echo "FALHA: ${name} (status=${actual}, esperado=${expected_csv})"
    exit 1
  fi
  echo "OK: ${name} (${actual})"
}

# 1) Public health must answer.
code_health="$(request_code GET "${BASE_URL}/api/health")"
assert_code "GET /api/health" "${code_health}" "200"

# 2) Login page must be reachable.
code_login="$(request_code GET "${BASE_URL}/login")"
assert_code "GET /login" "${code_login}" "200"

# 3) Protected app route should redirect or block without auth.
code_app="$(request_code GET "${BASE_URL}/app")"
assert_code "GET /app (sem sessao)" "${code_app}" "302,303,307"

# 4) Internal health must reject without token.
code_internal_no_token="$(request_code GET "${BASE_URL}/api/internal/health")"
if [[ "${MODE}" == "prod" ]]; then
  assert_code "GET /api/internal/health (sem token)" "${code_internal_no_token}" "401"
else
  assert_code "GET /api/internal/health (sem token)" "${code_internal_no_token}" "200,401"
fi

# 5) Debug/test routes should be blocked in production.
if [[ "${MODE}" == "prod" ]]; then
  code_debug="$(request_code GET "${BASE_URL}/api/debug/order-status?id=1")"
  assert_code "GET /api/debug/order-status (prod sem token)" "${code_debug}" "404"

  code_test="$(request_code POST "${BASE_URL}/api/test/seed-sales-order")"
  assert_code "POST /api/test/seed-sales-order (prod sem token)" "${code_test}" "404"
fi

# 6) Internal health should pass with token (if token is available).
if [[ -n "${INTERNAL_API_TOKEN:-}" ]]; then
  code_internal_with_token="$(
    request_code GET "${BASE_URL}/api/internal/health" "x-internal-token" "${INTERNAL_API_TOKEN}"
  )"
  assert_code "GET /api/internal/health (com token)" "${code_internal_with_token}" "200"
else
  echo "WARN: INTERNAL_API_TOKEN nao definido no ambiente; pulando validacao autenticada."
fi

echo "SUCESSO: smoke test concluido."
