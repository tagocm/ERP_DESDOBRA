import { describe, expect, it } from 'vitest';
import { parseLegacyNfeXml } from '@/lib/fiscal/nfe/legacy-import/parser';

const XML_WITH_PROTOCOL = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260203645616000108550010000085801632496383" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>8580</nNF>
        <dhEmi>2026-02-24T11:45:12-03:00</dhEmi>
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
        <CNPJ>09506351000143</CNPJ>
        <xNome>Comercio de Alimentos RRs Ltda</xNome>
        <indIEDest>1</indIEDest>
        <IE>119309230117</IE>
        <enderDest>
          <xLgr>Rua Projetada</xLgr>
          <nro>123</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SKU-1</cProd>
          <xProd>Granola Tradicional</xProd>
          <NCM>19042000</NCM>
          <CFOP>5101</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>10.00</vUnCom>
          <vProd>100.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <tpAmb>1</tpAmb>
      <chNFe>35260203645616000108550010000085801632496383</chNFe>
      <dhRecbto>2026-02-24T11:46:04-03:00</dhRecbto>
      <nProt>135260717254933</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

const XML_WITHOUT_PROTOCOL = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35260203645616000108550010000085811634504223" versao="4.00">
    <ide>
      <cUF>35</cUF>
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

describe('parseLegacyNfeXml', () => {
  it('parseia XML com protocolo autorizado', () => {
    const parsed = parseLegacyNfeXml(XML_WITH_PROTOCOL);

    expect(parsed.header.accessKey).toBe('35260203645616000108550010000085801632496383');
    expect(parsed.header.number).toBe('8580');
    expect(parsed.protocol.status).toBe('AUTHORIZED_WITH_PROTOCOL');
    expect(parsed.protocol.nProt).toBe('135260717254933');
    expect(parsed.destination.indIEDest).toBe('1');
    expect(parsed.destination.ie).toBe('119309230117');
    expect(parsed.destination.enderDest?.cMun).toBe('3550308');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].isProduced).toBe(true);
  });

  it('parseia XML sem protocolo e marca SEM_PROTOCOLO', () => {
    const parsed = parseLegacyNfeXml(XML_WITHOUT_PROTOCOL);

    expect(parsed.header.accessKey).toBe('35260203645616000108550010000085811634504223');
    expect(parsed.protocol.status).toBe('SEM_PROTOCOLO');
    expect(parsed.protocol.hasProtocol).toBe(false);
    expect(parsed.items[0].cfop).toBe('5102');
  });
});
