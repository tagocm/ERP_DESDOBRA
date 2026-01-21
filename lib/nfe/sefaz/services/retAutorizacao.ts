import { buildConsReciNFe } from "../xml/consReciNFe";
import { buildSoapEnvelopeRet } from "../soap/soapEnvelope";
import { soapRequest } from "../soap/soapClient";
import { parseSefazResponse } from "../soap/soapParse";
import { getSefazUrl } from "../endpoints";
import { SefazEnvConfig, SefazCertConfig, SefazResponse } from "../types";
import { NfeSefazError } from "../errors";

// Hardening constants
const MAX_ATTEMPTS = 10;
const MAX_TOTAL_TIME_MS = 90000; // 90 seconds
const INITIAL_BACKOFF_MS = 2000; // Start with 2s
const MAX_BACKOFF_MS = 10000; // Cap at 10s

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number): number {
    const exponential = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.5, attempt), MAX_BACKOFF_MS);
    const jitter = Math.random() * 0.3 * exponential; // ±30% jitter
    return Math.floor(exponential + jitter);
}

/**
 * Consultar recibo com hardening:
 * - Max attempts
 * - Total timeout
 * - Exponential backoff with jitter
 * - Status persistence callback
 */
export async function consultarRecibo(
    nRec: string,
    config: SefazEnvConfig,
    cert: SefazCertConfig,
    options?: import("../types").SefazRequestOptions,
    onStatusUpdate?: (status: 'processing' | 'completed', cStat?: string) => Promise<void>
): Promise<SefazResponse> {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;

        // Check total timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_TIME_MS) {
            throw new NfeSefazError(
                `Timeout ao consultar recibo (${MAX_TOTAL_TIME_MS}ms, ${attempts} tentativas)`,
                "TIMEOUT",
                { nRec, elapsed, attempts }
            );
        }

        try {
            // 1. Build XML
            const xmlCons = buildConsReciNFe(nRec, config.tpAmb);
            const soapBody = buildSoapEnvelopeRet(xmlCons);

            // 2. Determine URL
            const url = getSefazUrl(config.uf, config.tpAmb, "NFeRetAutorizacao4");
            const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote";

            // 3. Send Request
            const { body } = await soapRequest(url, soapAction, soapBody, cert, options);

            // 4. Parse Response
            const result = parseSefazResponse(body, "consultarRecibo");

            // 5. Check if still processing
            if (result.cStat === "105") {
                // Still processing
                if (onStatusUpdate) {
                    await onStatusUpdate('processing', '105');
                }

                // Calculate backoff
                const backoffMs = calculateBackoff(attempts);

                // Log if debug
                if (options?.debug) {
                    console.log(`[SEFAZ] Recibo ${nRec} em processamento. Tentativa ${attempts}/${MAX_ATTEMPTS}. Aguardando ${backoffMs}ms...`);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }

            // 6. Processing complete (authorized, rejected, etc.)
            if (onStatusUpdate) {
                await onStatusUpdate('completed', result.cStat);
            }

            return result;

        } catch (err: any) {
            if (err instanceof NfeSefazError) throw err;
            throw new NfeSefazError("Erro ao consultar recibo", "SEFAZ", err);
        }
    }

    // Max attempts exceeded
    throw new NfeSefazError(
        `Máximo de tentativas excedido (${MAX_ATTEMPTS}) ao consultar recibo`,
        "MAX_ATTEMPTS",
        { nRec, attempts: MAX_ATTEMPTS }
    );
}
