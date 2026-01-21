import { describe, it, expect } from "vitest";
import { parseSefazResponse } from "../soap/soapParse";

describe("SOAP Response Parsing", () => {
    it("should parse EnviNFe successful response (103)", () => {
        const xml = `
            <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
                <env:Body>
                    <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
                        <retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                            <tpAmb>2</tpAmb>
                            <verAplic>SP_NFE_PL_009_V4</verAplic>
                            <cStat>103</cStat>
                            <xMotivo>Lote recebido com sucesso</xMotivo>
                            <cUF>35</cUF>
                            <dhRecbto>2023-10-25T10:00:00-03:00</dhRecbto>
                            <infRec>
                                <nRec>351000000000001</nRec>
                                <tMed>1</tMed>
                            </infRec>
                        </retEnviNFe>
                    </nfeResultMsg>
                </env:Body>
            </env:Envelope>
        `;

        const result = parseSefazResponse(xml, "enviarLote");

        expect(result.cStat).toBe("103");
        expect(result.xMotivo).toBe("Lote recebido com sucesso");
        expect(result.nRec).toBe("351000000000001");
    });

    it("should parse ConsReciNFe authorized response (100)", () => {
        const xml = `
            <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
                <soap:Body>
                    <nfeResultMsg>
                        <retConsReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                            <tpAmb>2</tpAmb>
                            <verAplic>SP_NFE_PL_009_V4</verAplic>
                            <nRec>351000000000001</nRec>
                            <cStat>100</cStat>
                            <xMotivo>Autorizado o uso da NF-e</xMotivo>
                            <cUF>35</cUF>
                            <dhRecbto>2023-10-25T10:00:05-03:00</dhRecbto>
                            <protNFe versao="4.00">
                                <infProt>
                                    <tpAmb>2</tpAmb>
                                    <verAplic>SP_NFE_PL_009_V4</verAplic>
                                    <chNFe>352310...</chNFe>
                                    <dhRecbto>2023-10-25T10:00:05-03:00</dhRecbto>
                                    <nProt>135230000000001</nProt>
                                    <digVal>...</digVal>
                                    <cStat>100</cStat>
                                    <xMotivo>Autorizado o uso da NF-e</xMotivo>
                                </infProt>
                            </protNFe>
                        </retConsReciNFe>
                    </nfeResultMsg>
                </soap:Body>
            </soap:Envelope>
        `;

        const result = parseSefazResponse(xml, "consultarRecibo");

        expect(result.cStat).toBe("100");
        expect(result.xMotivo).toContain("Autorizado");
        expect(result.protNFeXml).toContain("<protNFe");
    });

    it("should handle SOAP Fault", () => {
        const xml = `
            <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
                <env:Body>
                    <env:Fault>
                        <env:Code>
                            <env:Value>env:Sender</env:Value>
                        </env:Code>
                        <env:Reason>
                            <env:Text xml:lang="en">Erro de Schema</env:Text>
                        </env:Reason>
                    </env:Fault>
                </env:Body>
            </env:Envelope>
        `;

        expect(() => parseSefazResponse(xml, "enviarLote")).toThrow("SOAP Fault: Erro de Schema");
    });
});
