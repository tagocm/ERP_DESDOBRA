import { describe, it, expect } from 'vitest';
import { parseSefazResponse } from '../soapParse';

describe('SEFAZ Response Parser', () => {
    describe('enviarLote responses', () => {
        it('should parse cStat 103 (Lote recebido com sucesso)', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            <retEnviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                <tpAmb>2</tpAmb>
                <cStat>103</cStat>
                <xMotivo>Lote recebido com sucesso</xMotivo>
                <cUF>35</cUF>
                <dhRecbto>2026-01-16T20:00:00-03:00</dhRecbto>
                <infRec>
                    <nRec>351000000000123</nRec>
                    <tMed>1</tMed>
                </infRec>
            </retEnviNFe>
        </nfeResultMsg>
    </soap12:Body>
</soap12:Envelope>`;

            const result = parseSefazResponse(xml, 'enviarLote');

            expect(result.cStat).toBe('103');
            expect(result.xMotivo).toBe('Lote recebido com sucesso');
            expect(result.nRec).toBe('351000000000123');
            expect(result.step).toBe('enviarLote');
        });

        it('should parse rejection (cStat 2xx-5xx)', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            <retEnviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                <tpAmb>2</tpAmb>
                <cStat>225</cStat>
                <xMotivo>Rejeição: Falha no Schema XML</xMotivo>
            </retEnviNFe>
        </nfeResultMsg>
    </soap12:Body>
</soap12:Envelope>`;

            const result = parseSefazResponse(xml, 'enviarLote');

            expect(result.cStat).toBe('225');
            expect(result.xMotivo).toContain('Rejeição');
            expect(result.nRec).toBeUndefined();
        });
    });

    describe('consultarRecibo responses', () => {
        it('should parse cStat 100 (Autorizada)', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
            <retConsReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                <tpAmb>2</tpAmb>
                <cStat>104</cStat>
                <xMotivo>Lote processado</xMotivo>
                <protNFe versao="4.00">
                    <infProt>
                        <tpAmb>2</tpAmb>
                        <verAplic>SVRS20170602150000</verAplic>
                        <chNFe>35260103645616000108550010000085071391222537</chNFe>
                        <dhRecbto>2026-01-16T20:00:00-03:00</dhRecbto>
                        <nProt>135260000000123</nProt>
                        <digVal>ABC123...</digVal>
                        <cStat>100</cStat>
                        <xMotivo>Autorizado o uso da NF-e</xMotivo>
                    </infProt>
                </protNFe>
            </retConsReciNFe>
        </nfeResultMsg>
    </soap12:Body>
</soap12:Envelope>`;

            const result = parseSefazResponse(xml, 'consultarRecibo');

            expect(result.cStat).toBe('104');
            expect(result.xMotivo).toBe('Lote processado');
            expect(result.protNFeXml).toContain('<protNFe');
            expect(result.protNFeXml).toContain('</protNFe>');
            expect(result.protNFeXml).toContain('cStat>100</cStat');
        });

        it('should parse cStat 105 (Em processamento)', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
            <retConsReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                <tpAmb>2</tpAmb>
                <cStat>105</cStat>
                <xMotivo>Lote em processamento</xMotivo>
            </retConsReciNFe>
        </nfeResultMsg>
    </soap12:Body>
</soap12:Envelope>`;

            const result = parseSefazResponse(xml, 'consultarRecibo');

            expect(result.cStat).toBe('105');
            expect(result.xMotivo).toBe('Lote em processamento');
        });
    });

    describe('SOAP Fault handling', () => {
        it('should throw on SOAP Fault', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <soap12:Fault>
            <soap12:Code>
                <soap12:Value>soap12:Receiver</soap12:Value>
            </soap12:Code>
            <soap12:Reason>
                <soap12:Text xml:lang="pt-BR">Erro interno do servidor</soap12:Text>
            </soap12:Reason>
        </soap12:Fault>
    </soap12:Body>
</soap12:Envelope>`;

            expect(() => parseSefazResponse(xml, 'enviarLote')).toThrow('SOAP Fault');
            expect(() => parseSefazResponse(xml, 'enviarLote')).toThrow('Erro interno do servidor');
        });

        it('should throw on malformed XML', () => {
            const xml = 'not-xml';

            expect(() => parseSefazResponse(xml, 'enviarLote')).toThrow();
        });
    });
});
