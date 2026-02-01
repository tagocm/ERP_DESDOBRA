import { soapRequest } from "../soap/soapClient";
import { buildSoapEnvelope } from "../soap/soapEnvelope";
import { parseSefazResponse } from "../soap/soapParse";
import { SefazEnvConfig, SefazCertConfig, SefazRequestOptions } from "../types";
import { NfeSefazError } from "../errors";
import { getSefazUrl } from "../endpoints";

export interface ConsultaProtocoloResult {
    cStat: string;
    xMotivo: string;
    protNFeXml?: string; // If approved
    rawResponse?: any;
}

export async function consultarProtocolo(
    accessKey: string,
    envConfig: Pick<SefazEnvConfig, 'uf' | 'tpAmb'>,
    certConfig: SefazCertConfig,
    options?: SefazRequestOptions
): Promise<ConsultaProtocoloResult> {
    // 1. Build XML for consSitNFe
    const xmlBody = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${envConfig.tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${accessKey}</chNFe></consSitNFe>`;

    // 2. Wrap in SOAP Envelope
    // Use generic envelope or creates specific logic if needed. 
    // Assuming standard NFeConsultaProtocolo4 uses same envelope structure.
    // However, header action acts differently.

    // Check endpoint URL logic - normally NFeConsultaProtocolo4
    const soapEnvelope = buildSoapEnvelope(xmlBody, envConfig.uf, 'NFeConsultaProtocolo4');

    // 3. Resolve URL
    const url = getSefazUrl(envConfig.uf, envConfig.tpAmb as any, 'NFeConsultaProtocolo4');
    const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF";

    // 4. Send Request (Correct signature: url, action, xml, cert, options)
    const { body, status } = await soapRequest(
        url,
        soapAction,
        soapEnvelope,
        certConfig,
        options
    );

    if (status !== 200) {
        throw new NfeSefazError(`Erro HTTP ao consultar protocolo: ${status}`, "HTTP", { body });
    }

    // 4. Parse Response
    const parsed = parseSefazResponse(body, "consultarProtocolo");

    // Check retConsSitNFe
    const ret = parsed;

    // Extract protNFe XML directly from raw response body to ensure signature integrity
    let protNFeXml: string | undefined;
    const match = body.match(/<protNFe[^>]*>[\s\S]*?<\/protNFe>/);
    if (match) {
        protNFeXml = match[0];
    }

    return {
        cStat: ret.cStat,
        xMotivo: ret.xMotivo,
        protNFeXml,
        rawResponse: ret
    };
}

