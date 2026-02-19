import { XMLParser } from "fast-xml-parser";
import { SefazResponse } from "../types";
import { NfeSefazError } from "../errors";

function extractProtNFeXml(xml: string): string | undefined {
    const match = xml.match(/<(?:\w+:)?protNFe\b[\s\S]*?<\/(?:\w+:)?protNFe>/i);
    return match?.[0];
}

// Extract logic
export function parseSefazResponse(xml: string, step: "enviarLote" | "consultarRecibo" | "consultarProtocolo"): SefazResponse {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true, // cleans soap:Body etc
        parseTagValue: false // Keep numbers as strings to avoid nRec conversion
    });

    try {
        const parsed = parser.parse(xml);

        // Navigate SOAP Body
        // Structure: Envelope -> Body -> nfeResultMsg -> retEnviNFe (or retConsReciNFe)
        const envelope = parsed.Envelope || parsed.soap12Envelope || parsed["soap:Envelope"];
        const body = envelope?.Body || envelope?.["soap:Body"];
        const fault = body?.Fault || body?.["soap:Fault"];

        if (fault) {
            let faultString = "Unknown SOAP Fault";

            // Extract Reason Text (handle fast-xml-parser object vs string)
            const reason = fault.Reason?.Text || fault.Reason || fault.faultstring;

            if (typeof reason === 'string') {
                faultString = reason;
            } else if (reason && typeof reason === 'object') {
                // If it has attributes like xml:lang, the text might be in #text
                if (reason["#text"]) {
                    faultString = reason["#text"];
                } else if (Array.isArray(reason)) {
                    // Could be array of texts
                    faultString = reason[0]?.["#text"] || reason[0] || JSON.stringify(reason);
                } else {
                    // Fallback using JSON stringify if structure is unexpected
                    faultString = JSON.stringify(reason);
                }
            }

            throw new NfeSefazError(`SOAP Fault: ${faultString}`, "SOAP", fault);
        }

        const nfeResult = body?.nfeResultMsg;
        if (!nfeResult) {
            throw new NfeSefazError("Resposta inválida: nfeResultMsg não encontrado", "PARSE", { xml });
        }

        let ret;
        if (step === "enviarLote") {
            ret = nfeResult.retEnviNFe;
        } else if (step === "consultarRecibo") {
            ret = nfeResult.retConsReciNFe;
        } else {
            ret = nfeResult.retConsSitNFe;
        }

        if (!ret) {
            throw new NfeSefazError(`Resposta inválida: nó de retorno para ${step} não encontrado`, "PARSE", { xml });
        }

        const cStat = ret.cStat?.toString() || "";
        const xMotivo = ret.xMotivo || "";

        const result: SefazResponse = {
            step,
            httpStatus: 200, // Assumed if we got here
            cStat,
            xMotivo,
            rawXml: xml
        };

        if (step === "enviarLote") {
            // Extract nRec (infRec.nRec)
            if (ret.infRec && ret.infRec.nRec) {
                result.nRec = ret.infRec.nRec;
            }
        }

        // Extract protNFe (Common to all if present)
        // Note: In Synchronous EnviNFe (104), protNFe is present directly.
        // In Async Return (104), protNFe is present in retConsReciNFe.
        if (ret.protNFe) {
            // We want the raw XML of protNFe
            const protXml = extractProtNFeXml(xml);
            if (protXml) {
                result.protNFeXml = protXml;
            }
        }

        return result;

    } catch (e: any) {
        if (e instanceof NfeSefazError) throw e;
        throw new NfeSefazError("Erro ao processar XML de resposta SEFAZ", "PARSE", { error: e.message, xml });
    }
}
