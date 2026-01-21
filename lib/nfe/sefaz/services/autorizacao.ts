import { buildEnviNFe } from "../xml/enviNFe";
import { buildSoapEnvelope } from "../soap/soapEnvelope";
import { soapRequest } from "../soap/soapClient";
import { parseSefazResponse } from "../soap/soapParse";
import { getSefazUrl } from "../endpoints";
import { SefazEnvConfig, SefazCertConfig, SefazResponse } from "../types";
import { NfeSefazError } from "../errors";

export async function enviarLote(
    config: SefazEnvConfig,
    cert: SefazCertConfig,
    options?: import("../types").SefazRequestOptions
): Promise<SefazResponse> {
    // 1. Build XMLs
    const xmlEnvi = buildEnviNFe(config.idLote, config.xmlNfeAssinado, config.indSinc);
    const soapBody = buildSoapEnvelope(xmlEnvi);

    // 2. Determine URL
    const url = getSefazUrl(config.uf, config.tpAmb, "NFeAutorizacao4");
    const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";

    // 3. Send Request
    try {
        const { body } = await soapRequest(url, soapAction, soapBody, cert, options);

        // 4. Parse Response
        return parseSefazResponse(body, "enviarLote");

    } catch (err: any) {
        if (err instanceof NfeSefazError) throw err;
        throw new NfeSefazError("Erro ao enviar lote para SEFAZ", "SEFAZ", err);
    }
}
