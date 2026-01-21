import { buildNfeXml } from "../../xml/buildNfeXml";
import { signNfeXml } from "../../sign/signNfeXml";
import { enviarLote } from "./autorizacao";
import { consultarRecibo } from "./retAutorizacao";
import { SefazEnvConfig, SefazCertConfig, SefazResponse, SefazRequestOptions } from "../types";
import { NfeSefazError } from "../errors";
import { NfeDraft } from "../../domain/types";
import { updateEmissionStatus } from "./persistence";

export interface EmitirNfeResult {
    success: boolean;
    nfeXmlAssinado: string;
    protNFeXml?: string; // Protocol of authorization
    cStat: string;
    xMotivo: string;
    nRec?: string; // Receipt number (if async)
    logs: string[];
}

export interface EmitirNfeOptions extends SefazRequestOptions {
    companyId?: string; // For persistence
    accessKey?: string; // For persistence
}

export async function emitirNfeHomolog(
    draft: NfeDraft,
    cert: SefazCertConfig,
    idLote: string,
    options?: EmitirNfeOptions
): Promise<EmitirNfeResult> {
    const logs: string[] = [];
    logs.push("Iniciando emissão em HOMOLOGAÇÃO");

    try {
        // 1. Build XML (Transmissible Mode)
        logs.push("Gerando XML...");
        const buildResult = buildNfeXml(draft, { mode: "transmissible", tzOffset: "-03:00" });
        const xmlBuilt = buildResult.xml;

        // 2. Sign XML
        logs.push("Assinando XML...");
        const { signedXml } = signNfeXml(xmlBuilt, { pfxBase64: cert.pfxBase64, pfxPassword: cert.pfxPassword });

        // 3. Config Env
        // Map cUF (e.g. "35") to UF (e.g. "SP")
        const ufMap: Record<string, string> = {
            "35": "SP", "52": "GO", "43": "RS", "31": "MG", "33": "RJ", "41": "PR", "42": "SC", // Add more as needed or move to shared
            "53": "DF", "51": "MT", "50": "MS", "29": "BA", "28": "SE", "27": "AL", "26": "PE",
            "25": "PB", "24": "RN", "23": "CE", "22": "PI", "21": "MA", "17": "TO", "16": "AP",
            "15": "PA", "14": "RR", "13": "AM", "12": "AC", "11": "RO"
        };
        const targetUF = ufMap[draft.ide.cUF] || "SP";

        const config: SefazEnvConfig = {
            xmlNfeAssinado: signedXml,
            idLote,
            indSinc: "1", // Sync by default (faster, SEFAZ preference)
            tpAmb: "2", // Homolog
            uf: targetUF
        };

        // 4. Send Batch
        logs.push(`Enviando Lote ID ${idLote} (Síncrono)...`);
        const respEnvio = await enviarLote(config, cert, options);
        logs.push(`Retorno Envio: ${respEnvio.cStat} - ${respEnvio.xMotivo}`);

        // Handle response based on cStat
        // cStat 104: Lote processado (sync) - check protNFe inside
        // cStat 103: Lote recebido (async) - need to poll
        // cStat 105: Em processamento - need to poll
        // Others: Rejection

        if (respEnvio.cStat === "104") {
            // Synchronous processing complete - extract protNFe
            logs.push("Lote processado imediatamente (síncrono)");

            if (!respEnvio.protNFeXml) {
                // Should not happen if parser is correct, but safe fallback
                throw new NfeSefazError("Lote processado mas protNFe não encontrado", "SEFAZ", { respEnvio });
            }

            // EXTRACT INNER STATUS FROM PROTOCOL
            // The batch is 104 (Processed), but the NFe might be 100, 302, 539, etc.
            const cStatMatch = respEnvio.protNFeXml.match(/<cStat>(\d+)<\/cStat>/);
            const xMotivoMatch = respEnvio.protNFeXml.match(/<xMotivo>(.*?)<\/xMotivo>/);

            const realCStat = cStatMatch ? cStatMatch[1] : respEnvio.cStat;
            const realXMotivo = xMotivoMatch ? xMotivoMatch[1] : respEnvio.xMotivo;

            return {
                success: realCStat === "100",
                nfeXmlAssinado: signedXml,
                protNFeXml: respEnvio.protNFeXml,
                cStat: realCStat,
                xMotivo: realXMotivo,
                logs
            };
        }

        if (respEnvio.cStat !== "103" && respEnvio.cStat !== "105") {
            // Rejection or error - not 103 (received) or 104 (processed)
            return {
                success: false,
                nfeXmlAssinado: signedXml,
                cStat: respEnvio.cStat,
                xMotivo: respEnvio.xMotivo,
                logs
            };
        }

        // Fallback: Async processing (cStat 103 or 105)
        logs.push("Resposta assíncrona detectada. Iniciando polling...");

        const nRec = respEnvio.nRec;
        if (!nRec) {
            throw new NfeSefazError("Lote recebido (103) mas sem nRec", "SEFAZ", { respEnvio });
        }

        // Persist "sent" status with receipt
        if (options?.companyId && options?.accessKey) {
            await updateEmissionStatus(options.accessKey, options.companyId, {
                status: 'sent',
                n_recibo: nRec,
                c_stat: respEnvio.cStat,
                x_motivo: respEnvio.xMotivo,
                attempts: 0,
                last_attempt_at: new Date().toISOString()
            });
        }

        // 5. Poll for Result with status updates
        logs.push(`Lote Recebido (nRec: ${nRec}). Aguardando processamento...`);

        let attempts = 0;

        // Status update callback for polling
        const onStatusUpdate = async (status: 'processing' | 'completed', cStat?: string) => {
            if (options?.companyId && options?.accessKey) {
                attempts++;
                await updateEmissionStatus(options.accessKey, options.companyId, {
                    status: status === 'processing' ? 'processing' : undefined,
                    c_stat: cStat,
                    attempts,
                    last_attempt_at: new Date().toISOString()
                });
            }
        };

        const respCons = await consultarRecibo(nRec, config, cert, options, onStatusUpdate);

        logs.push(`Resultado Final: ${respCons.cStat} - ${respCons.xMotivo}`);

        // Check for Authorization (100)
        const isAuthorized = respCons.cStat === "100";

        return {
            success: isAuthorized,
            nfeXmlAssinado: signedXml,
            protNFeXml: respCons.protNFeXml,
            cStat: respCons.cStat,
            xMotivo: respCons.xMotivo,
            nRec,
            logs
        };

    } catch (err: any) {
        const msg = err.message || "Erro desconhecido";
        logs.push(`ERRO: ${msg}`);

        if (err instanceof NfeSefazError) {
            throw err;
        }

        throw new NfeSefazError(msg, "SEFAZ", { originalError: err });
    }
}
