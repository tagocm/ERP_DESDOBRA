# Hardening da Conexão SEFAZ (TLS/SSL)

Este documento descreve como resolver problemas de conexão segura (TLS) com os servidores da SEFAZ, especificamente o erro `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

## O Problema
Servidores do governo brasileiro (SEFAZ) utilizam certificados assinados pela **ICP-Brasil**.
Muitos ambientes (Node.js padrão, imagens Docker Alpine/Debian mínimas, macOS) não possuem a cadeia completa de certificados da ICP-Brasil (Raiz v5/v10) em seu *trust store* padrão.
Isso causa erros de conexão pois o Node.js não consegue validar quem assinou o certificado do servidor.

## Diagnóstico
Para confirmar se este é o problema, executamos um script de diagnóstico que conecta diretamente no servidor e inspeciona a cadeia enviada.

### Rodando o Diagnóstico
1. Abra um terminal no projeto.
2. Execute o script:
   ```bash
   npx tsx scripts/diagnose-sefaz-tls.ts
   ```
   *Opcional: Passe a URL específica como argumento se quiser testar outro estado.*

3. Analise a saída.
   * Se vir `WARNING: No intermediate certificates sent by server`, o servidor não está enviando a cadeia completa.
   * Se o teste "Strict Connection" falhar com `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, você precisa configurar o Bundle manualmente.

## Solução (Produção & Dev)

### 1. Obter a Cadeia de Certificados (Bundle)
Você precisa de um arquivo `.pem` contendo a cadeia da ICP-Brasil (Raiz + Intermediárias).
O script de diagnóstico salva os certificados encontrados em `/tmp/desdobra-sefaz`. Você pode concatená-los:

```bash
cat /tmp/desdobra-sefaz/chain-*.pem > certs/sefaz-ca-bundle.pem
```

Alternativamente, baixe a cadeia completa no site do ITI (ICP-Brasil) ou exporte do seu navegador (Firefox/Chrome) ao acessar o site da SEFAZ.

### 2. Configurar Variável de Ambiente
Aponte o caminho do arquivo gerado:

```env
SEFAZ_CA_BUNDLE_PATH="./certs/sefaz-ca-bundle.pem"
```

O cliente SOAP (`soapClient.ts`) detectará esta variável e carregará o bundle explicitamente no agente HTTPS.

### 3. Debug Avançado
Para ver logs detalhados da negociação TLS e do carregamento do bundle, ative o debug:

```bash
SEFAZ_DEBUG=true npm run dev
```

Procure por logs iniciados com `[SEFAZ-DIAGNOSTIC]`. Verifique se aparece:
`Agent CA: Loaded effectively from file/env (Length: XXXXX)`

## Importante
* NUNCA use `NODE_TLS_REJECT_UNAUTHORIZED=0`. Isso remove toda a segurança.
* Garanta que o arquivo `.pem` exista no container de produção (copie no Dockerfile).
