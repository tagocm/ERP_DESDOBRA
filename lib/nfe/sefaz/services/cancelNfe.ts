import { XMLParser } from "fast-xml-parser";
import { getSefazUrl } from "../endpoints";
import { NfeSefazError } from "../errors";
import { soapRequest } from "../soap/soapClient";
import { buildSoapEnvelope } from "../soap/soapEnvelope";
import { SefazCertConfig, SefazRequestOptions } from "../types";
import { signEventXml } from "@/lib/nfe/sign/signEventXml";

type CancelNfeInput = {
    accessKey: string;
    protocolNumber: string;
    sequence: number;
    reason: string;
    tpAmb: "1" | "2";
    uf: string;
    issuerCnpj: string;
};

type CancelNfeResult = {
    success: boolean;
    cStat: string;
    xMotivo: string;
    eventCStat?: string;
    eventXMotivo?: string;
    eventProtocol?: string;
    signedXml: string;
    responseXml: string;
};

function escapeXml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function formatBrazilOffsetDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}

function parseCancelResponse(xml: string): {
    envelopeCStat: string;
    envelopeXMotivo: string;
    eventCStat?: string;
    eventXMotivo?: string;
    eventProtocol?: string;
} {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true,
        parseTagValue: false,
    });

    const parsed = parser.parse(xml);
    const envelope = parsed?.Envelope || parsed?.soap12Envelope || parsed?.["soap:Envelope"];
    const body = envelope?.Body || envelope?.["soap:Body"];
    const result = body?.nfeResultMsg?.retEnvEvento;

    if (!result?.cStat) {
        throw new NfeSefazError("Resposta da SEFAZ inválida para cancelamento.", "PARSE", { xml });
    }

    const retEvento = Array.isArray(result.retEvento) ? result.retEvento[0] : result.retEvento;
    const infEvento = retEvento?.infEvento || null;

    return {
        envelopeCStat: String(result.cStat || ""),
        envelopeXMotivo: String(result.xMotivo || ""),
        eventCStat: infEvento?.cStat ? String(infEvento.cStat) : undefined,
        eventXMotivo: infEvento?.xMotivo ? String(infEvento.xMotivo) : undefined,
        eventProtocol: infEvento?.nProt ? String(infEvento.nProt) : undefined,
    };
}

export async function submitNfeCancellation(
    input: CancelNfeInput,
    cert: SefazCertConfig,
    options?: SefazRequestOptions
): Promise<CancelNfeResult> {
    const sequence = String(input.sequence).padStart(2, "0");
    const eventId = `ID110111${input.accessKey}${sequence}`;
    const cOrgao = input.accessKey.slice(0, 2);
    const eventTimestamp = formatBrazilOffsetDate(new Date());

    const unsignedEventXml =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
        `<idLote>${Date.now().toString().slice(-15)}</idLote>` +
        `<evento versao="1.00">` +
        `<infEvento Id="${eventId}">` +
        `<cOrgao>${cOrgao}</cOrgao>` +
        `<tpAmb>${input.tpAmb}</tpAmb>` +
        `<CNPJ>${input.issuerCnpj}</CNPJ>` +
        `<chNFe>${input.accessKey}</chNFe>` +
        `<dhEvento>${eventTimestamp}</dhEvento>` +
        `<tpEvento>110111</tpEvento>` +
        `<nSeqEvento>${input.sequence}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        `<detEvento versao="1.00">` +
        `<descEvento>Cancelamento</descEvento>` +
        `<nProt>${escapeXml(input.protocolNumber)}</nProt>` +
        `<xJust>${escapeXml(input.reason)}</xJust>` +
        `</detEvento>` +
        `</infEvento>` +
        `</evento>` +
        `</envEvento>`;

    const { signedXml } = signEventXml(unsignedEventXml, {
        pfxBase64: cert.pfxBase64,
        pfxPassword: cert.pfxPassword,
    });

    const soapBody = buildSoapEnvelope(signedXml, input.uf, "NFeRecepcaoEvento4");
    const url = getSefazUrl(input.uf, input.tpAmb, "NFeRecepcaoEvento4");
    const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF";

    const { body, status } = await soapRequest(url, soapAction, soapBody, cert, options);
    if (status !== 200) {
        throw new NfeSefazError(`Erro HTTP ao cancelar NF-e: ${status}`, "HTTP", { body });
    }

    const parsed = parseCancelResponse(body);
    const eventCStat = parsed.eventCStat || parsed.envelopeCStat;
    const eventXMotivo = parsed.eventXMotivo || parsed.envelopeXMotivo;
    const isSuccess = parsed.envelopeCStat === "128" && (eventCStat === "135" || eventCStat === "136" || eventCStat === "155");

    return {
        success: isSuccess,
        cStat: parsed.envelopeCStat,
        xMotivo: parsed.envelopeXMotivo,
        eventCStat,
        eventXMotivo,
        eventProtocol: parsed.eventProtocol,
        signedXml,
        responseXml: body,
    };
}
