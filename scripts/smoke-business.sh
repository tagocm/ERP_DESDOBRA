#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
MODE="${2:-prod}" # prod|dev

INTERNAL_TOKEN="${INTERNAL_API_TOKEN:-}"
SESSION_COOKIE="${SESSION_COOKIE:-}"

command -v curl >/dev/null 2>&1 || { echo "ERRO: curl nao encontrado."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERRO: node nao encontrado."; exit 1; }

if [[ "${MODE}" == "prod" ]]; then
  [[ -n "${INTERNAL_TOKEN}" ]] || { echo "ERRO: INTERNAL_API_TOKEN ausente."; exit 1; }
  [[ -n "${SESSION_COOKIE}" ]] || { echo "ERRO: SESSION_COOKIE ausente (cookie de sessao de usuario autenticado)."; exit 1; }
fi

echo "==> Smoke business (${MODE}) em ${BASE_URL}"

tmp_seed="$(mktemp)"
tmp_debug="$(mktemp)"
tmp_delivery="$(mktemp)"
trap 'rm -f "${tmp_seed}" "${tmp_debug}" "${tmp_delivery}"' EXIT

curl_common=(
  -sS
  -H "Content-Type: application/json"
)

if [[ -n "${INTERNAL_TOKEN}" ]]; then
  curl_common+=(-H "x-internal-token: ${INTERNAL_TOKEN}")
fi
if [[ -n "${SESSION_COOKIE}" ]]; then
  curl_common+=(-H "Cookie: ${SESSION_COOKIE}")
fi

echo "==> Seed de pedido teste"
seed_code="$(
  curl "${curl_common[@]}" \
    -o "${tmp_seed}" \
    -w "%{http_code}" \
    -X POST \
    "${BASE_URL}/api/test/seed-sales-order" \
    --data '{}'
)"

if [[ "${seed_code}" != "200" ]]; then
  echo "FALHA: seed-sales-order retornou ${seed_code}"
  cat "${tmp_seed}"
  exit 1
fi

order_id="$(
  node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!r.success||!r.orderId) process.exit(2); process.stdout.write(r.orderId);" "${tmp_seed}" \
  || true
)"
[[ -n "${order_id}" ]] || { echo "FALHA: nao foi possivel extrair orderId do seed."; cat "${tmp_seed}"; exit 1; }
echo "OK: pedido criado ${order_id}"

echo "==> Debug status do pedido"
debug_code="$(
  curl "${curl_common[@]}" \
    -o "${tmp_debug}" \
    -w "%{http_code}" \
    -X GET \
    "${BASE_URL}/api/debug/order-status?id=${order_id}"
)"
if [[ "${debug_code}" != "200" ]]; then
  echo "FALHA: debug order-status retornou ${debug_code}"
  cat "${tmp_debug}"
  exit 1
fi

has_order="$(
  node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(r.order && r.order.id ? '1':'0');" "${tmp_debug}"
)"
[[ "${has_order}" == "1" ]] || { echo "FALHA: payload de order-status sem order."; cat "${tmp_debug}"; exit 1; }
echo "OK: order-status validado"

echo "==> Tentativa de create-delivery (sanity endpoint)"
delivery_code="$(
  curl "${curl_common[@]}" \
    -o "${tmp_delivery}" \
    -w "%{http_code}" \
    -X POST \
    "${BASE_URL}/api/test/create-delivery" \
    --data "{\"docId\":\"${order_id}\"}"
)"

if [[ "${delivery_code}" != "200" ]]; then
  echo "FALHA: create-delivery retornou ${delivery_code}"
  cat "${tmp_delivery}"
  exit 1
fi

echo "OK: endpoint create-delivery respondeu 200"
echo "SUCESSO: smoke business concluido."
