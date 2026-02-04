# Flags e APIs internas

Este projeto usa algumas flags de ambiente para **segurança** e **debug controlado**.

## Flags (env)

- `EXPOSE_ERROR_DETAILS=true`
  - **Padrão:** `false` em produção.
  - Quando `true`, APIs podem retornar `error.details` em respostas JSON (útil para debug).

- `EXPOSE_NFE_XML=true`
  - **Padrão:** `false` em produção.
  - Controla se endpoints de NF-e podem retornar XML completo em respostas.

- `EXPOSE_NFE_LOGS=true`
  - **Padrão:** `false` em produção.
  - Controla se endpoints de NF-e podem retornar logs de debug em respostas (use com cuidado: pode conter dados sensíveis).

- `SECURITY_HEADERS=true`
  - **Padrão:** em produção os headers já são aplicados; em dev pode ser usado para testar.

- `INTERNAL_API_TOKEN=...`
  - Token para **rotas internas** (debug/operacionais).
  - Recomendado enviar via header `x-internal-token` (ou `Authorization: Bearer ...` em rotas que suportam).

## Rotas internas

### Healthcheck interno

`GET /api/internal/health`

Headers:
- `x-internal-token: <INTERNAL_API_TOKEN>` (ou `Authorization: Bearer <INTERNAL_API_TOKEN>`)

Resposta:
```json
{ "ok": true, "timestamp": "2026-02-04T00:00:00.000Z", "durationMs": 12, "checks": { "db": { "ok": true }, "storage": { "ok": true } } }
```

### Processar inbox do mobile

`POST /api/internal/mobile/process`

Headers:
- `x-internal-token: <INTERNAL_API_TOKEN>`

Body (JSON):
```json
{ "limit": 50, "company_id": "uuid-opcional", "dry_run": false }
```

Resposta:
```json
{ "ok": true, "result": { "totalFetched": 0, "processed": 0, "alreadyExists": 0, "errors": 0 } }
```

### Script local (processamento)

```bash
npx tsx scripts/mobile/process-expenses.ts --limit 50
```

Opções:
- `--company <uuid>`
- `--dry-run`
