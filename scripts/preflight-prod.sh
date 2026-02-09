#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$(pwd)}"

required_env=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  INTERNAL_API_TOKEN
  CERT_PASSWORD_ENCRYPTION_KEY
  NFE_ENVIRONMENT
)

echo "==> Preflight production: ${APP_DIR}"
cd "${APP_DIR}"

if [[ ! -f package.json ]]; then
  echo "ERRO: package.json nao encontrado em ${APP_DIR}"
  exit 1
fi

echo "==> Validando variaveis de ambiente obrigatorias"
missing=0
for env_name in "${required_env[@]}"; do
  if [[ -z "${!env_name:-}" ]]; then
    echo "FALTA: ${env_name}"
    missing=1
  fi
done
if [[ "${missing}" -ne 0 ]]; then
  echo "ERRO: preencha as variaveis obrigatorias antes do deploy."
  exit 1
fi

if [[ "${NFE_ENVIRONMENT}" != "producao" ]]; then
  echo "ERRO: NFE_ENVIRONMENT precisa ser 'producao' para go-live."
  exit 1
fi

if [[ -n "${NEXT_PUBLIC_DEV_COMPANY_ID:-}" ]]; then
  echo "ERRO: NEXT_PUBLIC_DEV_COMPANY_ID deve ficar vazio em producao."
  exit 1
fi

if [[ "${NFE_DEBUG:-false}" == "true" || "${NFE_WS_DEBUG:-false}" == "true" || "${SEFAZ_DEBUG:-false}" == "true" ]]; then
  echo "ERRO: flags de debug fiscal devem estar desativadas em producao."
  exit 1
fi

echo "==> Versoes"
node -v
npm -v

echo "==> Instalando dependencias reproduziveis"
npm ci

echo "==> Typecheck"
npm run typecheck

echo "==> Lint (quiet)"
npm run lint -- --quiet

echo "==> Unit tests"
npm run test:run

echo "==> Build de producao com webpack"
npm run build -- --webpack

echo "==> Smoke local (app ainda nao iniciado)"
if [[ ! -d ".next" ]]; then
  echo "ERRO: build nao gerou .next"
  exit 1
fi

echo "SUCESSO: preflight passou. Pode iniciar servicos systemd."
