# Módulo NF-e SEFAZ

Este módulo implementa a comunicação com a SEFAZ para transmissão de NF-e (Modelo 55) via SOAP 1.2 com mTLS.

## Funcionalidades

- **Emissão (Homologação)**: Fluxo completo de construção XML, assinatura, envio de lote e consulta de processamento.
- **mTLS**: Suporte a certificado digital A1 (PFX).
- **Custom CA**: Suporte a cadeia de certificação customizada (ICP-Brasil) para ambientes onde a CA raiz não é confiável pelo Node.js.
- **Debug Mode**: Geração de logs e artefatos (XMLs de request/response) para troubleshooting.

## Configuração

### Certificado Digital (A1 PFX)
O módulo espera o conteúdo do arquivo PFX em Base64 e a senha.

### Cadeia de Certificação (ICP-Brasil)
Em alguns ambientes (containers, linux minimal), a cadeia ICP-Brasil pode não estar presente, causando erro `UNABLE_TO_VERIFY_LEAF_SIGNATURE` ou similar.

Para resolver, você pode:
1. Definir a variável de ambiente `SEFAZ_CA_BUNDLE_PATH` apontando para o arquivo `.pem` da cadeia completa.
2. Ou passar o conteúdo PEM diretamente na opção `caPem`.

## Uso

### Emissão em Homologação

```typescript
import { emitirNfeHomolog } from "lib/nfe/sefaz/services/emitir";

const resultado = await emitirNfeHomolog(
    draft, // NfeDraft
    { pfxBase64: "...", pfxPassword: "..." }, // Credenciais
    "123456", // ID do Lote
    {
        debug: true, // Habilita logs detalhados e artefatos em /tmp/desdobra-sefaz
        timeoutMs: 60000
    }
);

if (resultado.success) {
    console.log("Nota Autorizada!", result.protNFeXml);
} else {
    console.error("Rejeição:", result.xMotivo);
}
```

### Estrutura de Pastas de Debug
Quando `debug: true`, os arquivos são salvos por padrão em `/tmp/desdobra-sefaz/`:
- `*.request.soap.xml`: Envelope SOAP enviado.
- `*.request.inner.xml`: Conteúdo da mensagem (enviNFe/consReciNFe).
- `*.response.soap.xml`: Resposta bruta da SEFAZ.
- `*.meta.json`: Metadados da requisição (URL, Status, Headers).
