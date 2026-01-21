# NF-e XML Builder (Módulo lib/nfe)

Este módulo é responsável pela geração do XML da NF-e Layout 4.00 a partir de um objeto `NfeDraft`.

## Estrutura

- `domain/`: Tipos e regras de validação.
- `xml/`: Builders das seções XML e orquestrador principal.
- `__tests__/`: Testes unitários e fixtures.

## Scripts de Debug

Para inspecionar o XML gerado durante o desenvolvimento, utilize os scripts abaixo:

### Gerar XML Completo
Gera o XML completo sem cortes. Útil para validar estrutura ou importar em validadores externos.

```bash
npx tsx scripts/dump-nfe-xml.ts
# Ou salvar em arquivo:
npx tsx scripts/dump-nfe-xml.ts > /tmp/nfe.xml
```

### Inspecionar Blocos (Det/Total/Pag)
Imprime apenas blocos específicos para conferência rápida de valores.

```bash
npx tsx scripts/dump-nfe-xml-blocks.ts
```

## Testes

```bash
npx vitest run lib/nfe
```
