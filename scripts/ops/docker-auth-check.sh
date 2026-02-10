#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://erp.martigran.com.br}"
WEB_SERVICE="${2:-web}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERRO: docker compose nao encontrado."
  exit 1
fi

echo "==> 1) Validando endpoints publicos"
curl -sS -o /dev/null -w "GET /api/health => %{http_code}\n" "${BASE_URL}/api/health"
curl -sS -o /dev/null -w "GET /api/auth/health => %{http_code}\n" "${BASE_URL}/api/auth/health"

echo
echo "==> 2) Validando envs dentro do container (${WEB_SERVICE})"
"${COMPOSE[@]}" exec -T "${WEB_SERVICE}" sh -lc '
missing=0
for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if [ -z "${!name:-}" ]; then
    echo "FALTA: $name"
    missing=1
  else
    echo "OK: $name presente"
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 2
fi
'

echo
echo "==> 3) Testando conectividade Supabase Auth a partir do container"
"${COMPOSE[@]}" exec -T "${WEB_SERVICE}" sh -lc '
set -e
URL="${NEXT_PUBLIC_SUPABASE_URL%/}/auth/v1/health"
code="$(curl -sS -o /dev/null -w "%{http_code}" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" "$URL")"
echo "Supabase Auth health => ${code}"
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  exit 3
fi
'

echo
echo "SUCESSO: diagnostico Docker/Auth concluido."
