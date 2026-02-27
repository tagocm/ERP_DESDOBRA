import { describe, expect, it } from 'vitest';
import { importLegacyNfeXmlFiles } from '@/lib/fiscal/nfe/legacy-import/importer';

const XML_VALID = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35260203645616000108550010000085811634504223" versao="4.00">
    <ide>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>8581</nNF>
      <dhEmi>2026-02-24T13:52:18-03:00</dhEmi>
      <tpAmb>1</tpAmb>
    </ide>
    <emit>
      <CNPJ>03645616000108</CNPJ>
      <xNome>Martigran Industria de Alimentos Ltda</xNome>
      <enderEmit>
        <UF>SP</UF>
      </enderEmit>
    </emit>
    <dest>
      <CNPJ>48555193001650</CNPJ>
      <xNome>So Ofertas Ltda</xNome>
      <enderDest>
        <UF>SP</UF>
      </enderDest>
    </dest>
    <det nItem="1">
      <prod>
        <cProd>SKU-2</cProd>
        <xProd>Pasta de Amendoim</xProd>
        <NCM>20081100</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>5.0000</qCom>
        <vUnCom>46.00</vUnCom>
        <vProd>230.00</vProd>
      </prod>
    </det>
    <total>
      <ICMSTot>
        <vNF>230.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

const XML_INVALID = `<?xml version="1.0" encoding="UTF-8"?>
<NFe><infNFe Id="NFe123"><ide><nNF>1</nNF></ide></infNFe></NFe>`;

function createUploadFile(name: string, content: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => content,
  };
}

describe('importLegacyNfeXmlFiles', () => {
  it('importa XML válido e identifica duplicidade por chave', async () => {
    const existingByKey = new Map<string, string>();
    const insertedByKey = new Map<string, string>();

    const dependencies = {
      findExistingEmissionByAccessKey: async (_companyId: string, accessKey: string) => {
        return existingByKey.get(accessKey) ?? insertedByKey.get(accessKey) ?? null;
      },
      uploadXmlToStorage: async (_companyId: string, accessKey: string) => `companies/test/nfe/legacy/${accessKey}.xml`,
      insertEmission: async ({ parsed }: { parsed: { header: { accessKey: string } } }) => {
        const id = crypto.randomUUID();
        insertedByKey.set(parsed.header.accessKey, id);
        return id;
      },
      insertItems: async () => {},
      insertAuditLog: async () => {},
      rollbackEmission: async () => {},
      rollbackStorage: async () => {},
    };

    const first = await importLegacyNfeXmlFiles({
      companyId: '7310b348-5a11-4f14-bc5a-8c5a33bc6393',
      userId: '15cd1234-8d7e-46f5-9f34-9fd17b638c10',
      files: [createUploadFile('nfe-1.xml', XML_VALID)],
      dependencies,
    });

    expect(first.imported).toBe(1);
    expect(first.duplicated).toBe(0);
    expect(first.errors).toBe(0);
    expect(first.results[0].result).toBe('SUCCESS');

    const second = await importLegacyNfeXmlFiles({
      companyId: '7310b348-5a11-4f14-bc5a-8c5a33bc6393',
      userId: '15cd1234-8d7e-46f5-9f34-9fd17b638c10',
      files: [createUploadFile('nfe-1-duplicate.xml', XML_VALID)],
      dependencies,
    });

    expect(second.imported).toBe(0);
    expect(second.duplicated).toBe(1);
    expect(second.results[0].result).toBe('DUPLICATE');
  });

  it('retorna erro por arquivo inválido sem interromper lote', async () => {
    const dependencies = {
      findExistingEmissionByAccessKey: async () => null,
      uploadXmlToStorage: async (_companyId: string, accessKey: string) => `companies/test/nfe/legacy/${accessKey}.xml`,
      insertEmission: async () => crypto.randomUUID(),
      insertItems: async () => {},
      insertAuditLog: async () => {},
      rollbackEmission: async () => {},
      rollbackStorage: async () => {},
    };

    const result = await importLegacyNfeXmlFiles({
      companyId: '7310b348-5a11-4f14-bc5a-8c5a33bc6393',
      userId: '15cd1234-8d7e-46f5-9f34-9fd17b638c10',
      files: [
        createUploadFile('ok.xml', XML_VALID),
        createUploadFile('invalid.xml', XML_INVALID),
      ],
      dependencies,
    });

    expect(result.imported).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.results[1].result).toBe('ERROR');
  });
});

