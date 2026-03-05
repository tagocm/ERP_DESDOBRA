import { describe, expect, it } from "vitest";
import { normalizeDistributionDoc } from "@/lib/fiscal/inbound/normalize";

const RES_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resNFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <chNFe>35260203645616000108550010000085801632496383</chNFe>
  <CNPJ>03645616000108</CNPJ>
  <xNome>Fornecedor Exemplo LTDA</xNome>
  <CNPJDest>09506351000143</CNPJDest>
  <dhEmi>2026-03-05T10:20:00-03:00</dhEmi>
  <vNF>199.90</vNF>
</resNFe>`;

const PROC_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260203645616000108550010000085801632496383" versao="4.00">
      <ide>
        <dhEmi>2026-03-05T11:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>03645616000108</CNPJ>
        <xNome>Fornecedor Exemplo LTDA</xNome>
      </emit>
      <dest>
        <CNPJ>09506351000143</CNPJ>
      </dest>
      <total>
        <ICMSTot>
          <vNF>350.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const RES_EVENTO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resEvento xmlns="http://www.portalfiscal.inf.br/nfe">
  <chNFe>35260203645616000108550010000085801632496383</chNFe>
  <xNome>Evento de NF-e</xNome>
  <dhEvento>2026-03-05T12:40:00-03:00</dhEvento>
</resEvento>`;

function toBase64(xml: string): string {
  return Buffer.from(xml, "utf8").toString("base64");
}

describe("normalizeDistributionDoc", () => {
  it("normaliza resNFe", () => {
    const normalized = normalizeDistributionDoc({
      nsu: "000000000000001",
      schema: "resNFe",
      xmlBase64: toBase64(RES_NFE_XML),
      xmlIsGz: false,
    });

    expect(normalized.nsu).toBe("000000000000001");
    expect(normalized.schema).toBe("resNFe");
    expect(normalized.chnfe).toBe("35260203645616000108550010000085801632496383");
    expect(normalized.emitCnpj).toBe("03645616000108");
    expect(normalized.destCnpj).toBe("09506351000143");
    expect(normalized.emitNome).toBe("Fornecedor Exemplo LTDA");
    expect(normalized.total).toBe(199.9);
    expect(normalized.hasFullXml).toBe(false);
  });

  it("normaliza procNFe com XML completo", () => {
    const normalized = normalizeDistributionDoc({
      nsu: "000000000000002",
      schema: "procNFe",
      xmlBase64: toBase64(PROC_NFE_XML),
      xmlIsGz: false,
    });

    expect(normalized.nsu).toBe("000000000000002");
    expect(normalized.schema).toBe("procNFe");
    expect(normalized.chnfe).toBe("35260203645616000108550010000085801632496383");
    expect(normalized.emitCnpj).toBe("03645616000108");
    expect(normalized.destCnpj).toBe("09506351000143");
    expect(normalized.total).toBe(350.5);
    expect(normalized.hasFullXml).toBe(true);
  });

  it("normaliza resEvento", () => {
    const normalized = normalizeDistributionDoc({
      nsu: "000000000000003",
      schema: "resEvento",
      xmlBase64: toBase64(RES_EVENTO_XML),
      xmlIsGz: false,
    });

    expect(normalized.nsu).toBe("000000000000003");
    expect(normalized.schema).toBe("resEvento");
    expect(normalized.chnfe).toBe("35260203645616000108550010000085801632496383");
    expect(normalized.emitNome).toBe("Evento de NF-e");
    expect(normalized.hasFullXml).toBe(false);
  });
});
