# NF-e Production Hardening - Summary

## ✅ Entregues

### 1. Certificate Loader (`certificateLoader.ts`)
```typescript
loadCompanyCertificate(companyId)
```
- ✅ Cache 15min em memória
- ✅ Deduplicação de requisições concorrentes
- ✅ Validação PFX (chave privada + expiração)
- ✅ Zero logs de credenciais
- ✅ Carrega de Supabase Storage + Vault

### 2. Hardened Polling (`retAutorizacao.ts`)
```typescript
consultarRecibo(nRec, config, cert, options, onStatusUpdate)
```
- ✅ Exponential backoff com jitter
- ✅ Max 10 tentativas, 90s timeout total
- ✅ Callback para persistence de status intermediário

### 3. Debug Sanitization (`soapClient.ts`)
- ✅ Regex para remover `pfxBase64`, `password`, tokens
- ✅ Artifacts salvos sanitizados em `/tmp/desdobra-sefaz/`

### 4. Comprehensive Persistence (`persistence.ts`)
```typescript
interface NfeEmissionRecord {
  status, c_stat, x_motivo,
  n_recibo, attempts, last_attempt_at, ...
}
```
- ✅ `checkIdempotency()` - previne reemissão
- ✅ `upsertNfeEmission()` - usa admin client (bypassa RLS)
- ✅ `buildNfeProc()` - monta XML final

### 5. Production API Route
**`app/api/nfe/authorize/route.ts`**
- ✅ `runtime = 'nodejs'` para mTLS
- ✅ Autenticação completa
- ✅ Idempotência
- ✅ Certificate loading com cache
- ✅ State persistence durante todo fluxo
- ✅ Error handling robusto

### 6. Emission Service Updates
**`emitir.ts`** - **REQUER EDIÇÃO MANUAL**:

Adicione após linha 11:
```typescript
import { updateEmissionStatus } from "./persistence";

// ... (resto do código)

export interface EmitirNfeOptions {
    companyId?: string;
    accessKey?: string;
    debug?: boolean;
    debugDir?: string;
    debugMaxBodyChars?: number;
    timeoutMs?: number;
    caPem?: string | Buffer;
}
```

Substitua linha ~22:
```typescript
// DE:
options?: import("../types").SefazRequestOptions

// PARA:
options?: EmitirNfeOptions
```

---

## Checklist de Uso

1. ✅ Aplicar migration: `npx supabase db push`
2. ⚠️ Editar `emitir.ts` manualmente (tipo EmitirNfeOptions)
3. ✅ Certificado configurado na empresa (UI existente)
4. ✅ Testar via API: `POST /api/nfe/authorize`

---

## Teste Rápido

```bash
curl -X POST http://localhost:3000/api/nfe/authorize \
  -H 'Content-Type: application/json' \
  -d '{
    "companyId": "uuid",
    "tpAmb": "2",
    "draft": { ... }
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "cStat": "100",
  "xMotivo": "Autorizado o uso da NF-e",
  "logs": [...],
  "xmlNfeProc": "<?xml..."
}
```

---

## Arquivos Criados

1. `lib/nfe/sefaz/services/certificateLoader.ts` ✅
2. `lib/nfe/sefaz/services/retAutorizacao.ts` ✅ (overwrite)
3. `lib/nfe/sefaz/services/persistence.ts` ✅ (updated)
4. `lib/nfe/sefaz/soap/soapClient.ts` ✅ (sanitization)
5. `app/api/nfe/authorize/route.ts` ✅

## Arquivos com Pendência

- `lib/nfe/sefaz/services/emitir.ts` - requer edição manual do tipo EmitirNfeOptions
