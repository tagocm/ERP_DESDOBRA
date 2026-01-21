# Ajustes Finais - NF-e SEFAZ Authorization

## 1. ✅ indSinc Default = 1 (Síncrono)

**Arquivo**: `lib/nfe/sefaz/services/emitir.ts`

**Mudança**:
- Padrão alterado de `indSinc="0"` para `indSinc="1"`
- Adicionada lógica inteligente para detectar resposta:
  - **cStat 104** → Processado síncronamente, retorna imediatamente
  - **cStat 103/105** → Fallback para polling (assíncrono)
  - **Outros** → Rejeição, retorna erro

**Benefício**: Respostas mais rápidas (maioria dos casos < 5s) sem espera desnecessária.

---

## 2. ✅ Runtime Node.js Garantido

**Arquivo**: `app/api/nfe/authorize/route.ts` (criado como exemplo)

**Mudança**:
```typescript
// CRITICAL: Force Node.js runtime for mTLS support
export const runtime = 'nodejs';
```

**Importante**: Qualquer API route que chame `soapClient` ou use mTLS **DEVE** incluir esta linha.

**Motivo**: Edge Runtime não suporta HTTPS Agent com certificados mTLS.

---

## 3. ✅ Persistência com RLS Resolvida

**Arquivo**: `lib/nfe/sefaz/services/persistence.ts` (criado)

**Soluções implementadas**:

### 3.1 Admin Client (Bypass RLS)
Todos os métodos de persistência usam `createAdminClient()` (service role):
- `checkIdempotency()`
- `upsertNfeEmission()`
- `updateEmissionStatus()`

Isso bypassa as políticas RLS, permitindo operações de backend sem depender da sessão do usuário.

### 3.2 Idempotência Garantida
```typescript
// Verifica se NF-e já foi autorizada
const existing = await checkIdempotency(accessKey, companyId);
if (existing) {
    return { success: true, message: 'NF-e já autorizada', emission: existing };
}
```

**Constraint SQL aplicada**:
```sql
CREATE UNIQUE INDEX idx_nfe_emissions_company_key 
ON nfe_emissions(company_id, access_key);
```

Previne duplicação mesmo em condições de race (múltiplas requisições simultâneas).

### 3.3 Helper buildNfeProc()
Monta o XML final `nfeProc` (NFe + protNFe) automaticamente:
```typescript
const xmlFinal = buildNfeProc(nfeXmlAssinado, protNFeXml);
```

---

## Exemplo de Uso Completo

```typescript
// app/api/nfe/authorize/route.ts

export const runtime = 'nodejs'; // ⚠️ OBRIGATÓRIO

export async function POST(request: NextRequest) {
    const { draft, companyId } = await request.json();
    
    // 1. Idempotência
    const existing = await checkIdempotency(draft.ide.chNFe, companyId);
    if (existing) {
        return NextResponse.json({ success: true, emission: existing });
    }
    
    // 2. Load certificate
    const cert = await loadCompanyCertificate(companyId);
    
    // 3. Emit (indSinc=1 automático)
    const result = await emitirNfeHomolog(draft, cert, idLote);
    
    // 4. Persist
    await upsertNfeEmission({
        company_id: companyId,
        access_key: draft.ide.chNFe,
        status: result.success ? 'authorized' : 'rejected',
        xml_signed: result.nfeXmlAssinado,
        xml_nfe_proc: result.protNFeXml ? buildNfeProc(...) : null,
        // ...
    });
    
    return NextResponse.json(result);
}
```

---

## Checklist de Integração

- [x] `indSinc=1` configurado
- [x] Fallback polling para 103/105
- [x] `runtime='nodejs'` em API routes
- [x] Persistência usa admin client
- [x] Idempotência implementada
- [x] `buildNfeProc()` helper criado

## Próximo Passo

Implementar `loadCompanyCertificate()` para buscar certificado do Supabase Storage + Vault.
