import { describe, it, expect } from 'vitest';
import { buildSoapEnvelope, buildSoapEnvelopeRet } from '../soapEnvelope';

describe('SOAP Envelope Builders', () => {
    describe('buildSoapEnvelope (NFeAutorizacao4)', () => {
        it('should build valid SOAP envelope with correct namespaces', () => {
            const bodyContent = '<enviNFe versao="4.00"><idLote>123</idLote></enviNFe>';
            const result = buildSoapEnvelope(bodyContent);

            expect(result).toContain('<?xml version="1.0" encoding="utf-8"?>');
            expect(result).toContain('soap12:Envelope');
            expect(result).toContain('xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"');
            expect(result).toContain('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">');
            expect(result).toContain(bodyContent);
        });

        it('should preserve inner content exactly', () => {
            const bodyContent = '<test>Special &lt;chars&gt;</test>';
            const result = buildSoapEnvelope(bodyContent);

            expect(result).toContain(bodyContent);
        });

        it('should create deterministic output', () => {
            const bodyContent = '<enviNFe versao="4.00"></enviNFe>';
            const result1 = buildSoapEnvelope(bodyContent);
            const result2 = buildSoapEnvelope(bodyContent);

            expect(result1).toBe(result2);
        });

        it('should match snapshot', () => {
            const bodyContent = '<enviNFe versao="4.00"><idLote>202601160001</idLote><indSinc>1</indSinc></enviNFe>';
            const result = buildSoapEnvelope(bodyContent);

            expect(result).toMatchSnapshot();
        });
    });

    describe('buildSoapEnvelopeRet (NFeRetAutorizacao4)', () => {
        it('should build valid SOAP envelope with RetAutorizacao namespace', () => {
            const bodyContent = '<consReciNFe versao="4.00"><tpAmb>2</tpAmb><nRec>123456</nRec></consReciNFe>';
            const result = buildSoapEnvelopeRet(bodyContent);

            expect(result).toContain('<?xml version="1.0" encoding="utf-8"?>');
            expect(result).toContain('soap12:Envelope');
            expect(result).toContain('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">');
            expect(result).toContain(bodyContent);
        });

        it('should have different namespace than NFeAutorizacao4', () => {
            const bodyContent = '<test/>';
            const autorizacao = buildSoapEnvelope(bodyContent);
            const retAutorizacao = buildSoapEnvelopeRet(bodyContent);

            expect(autorizacao).toContain('NFeAutorizacao4');
            expect(autorizacao).not.toContain('NFeRetAutorizacao4');

            expect(retAutorizacao).toContain('NFeRetAutorizacao4');
            expect(retAutorizacao).not.toContain('NFeAutorizacao4">');
        });

        it('should match snapshot', () => {
            const bodyContent = '<consReciNFe versao="4.00"><tpAmb>2</tpAmb><nRec>351000000000123</nRec></consReciNFe>';
            const result = buildSoapEnvelopeRet(bodyContent);

            expect(result).toMatchSnapshot();
        });
    });
});
