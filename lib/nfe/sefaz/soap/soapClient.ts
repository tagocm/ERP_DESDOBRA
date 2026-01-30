import https from "https";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NfeSefazError } from "../errors";
import { parsePfx } from "../../sign/cert";
import { SefazCertConfig, SefazRequestOptions } from "../types";

export async function soapRequest(
    url: string,
    soapAction: string,
    xmlBody: string,
    certConfig: SefazCertConfig,
    options: SefazRequestOptions = {}
): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        let pfxData;

        // CHECKPOINT: Aggressive Debugging for TLS (Moved Up)
        const isDebug = !!options.debug || process.env.SEFAZ_DEBUG === 'true';

        try {
            pfxData = parsePfx(certConfig.pfxBase64, certConfig.pfxPassword);
        } catch (err: any) {
            // ... (error handling remains same)
            // Diagnostic Classification
            let hint = "UNKNOWN";
            const msg = (err.message || "").toLowerCase();

            if (msg.includes("bad decrypt") || msg.includes("mac verify failure") || msg.includes("invalid password")) {
                hint = "PFX_PASSWORD_INVALID";
            } else if (msg.includes("no start line") || msg.includes("wrong tag") || msg.includes("asn1")) {
                hint = "PFX_CORRUPT_OR_WRONG_ENCODING";
            } else if (process.version && !process.version.startsWith('v')) {
                hint = "EDGE_RUNTIME_DETECTED";
            }

            // Diagnostic Logging
            const diagnosticInfo = {
                timestamp: new Date().toISOString(),
                errorName: err.name,
                errorMessage: err.message,
                errorCode: err.code,
                hint,
                pfxByteLength: certConfig.pfxBase64 ? Buffer.from(certConfig.pfxBase64, 'base64').length : 0,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            };

            const logPath = '/tmp/cert-diagnostics.log';
            const logEntry = `\n[DIAGNOSTIC] ${JSON.stringify(diagnosticInfo, null, 2)}\nStack: ${err.stack}\n`;

            try {
                fs.appendFileSync(logPath, logEntry);
            } catch (e) {
                console.error('Failed to write diagnostic log', e);
            }

            console.error('[soapClient] PFX Parse Error:', diagnosticInfo);

            // Reject with structured error
            const structuredError: any = new NfeSefazError("Erro ao processar certificado para mTLS", "CERT", err);
            structuredError.details = {
                code: "CERT_MTLS_FAILED",
                hint,
                detail: err.message,
                pfxByteLength: diagnosticInfo.pfxByteLength
            };

            return reject(structuredError);
        }

        // Resolve CA Bundle
        let ca: string | Buffer | undefined = undefined;
        if (options.caPem) {
            ca = options.caPem;
        } else if (process.env.SEFAZ_CA_BUNDLE_PATH) {
            try {
                // Handle relative vs absolute paths
                let bundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;
                if (!path.isAbsolute(bundlePath)) {
                    bundlePath = path.resolve(process.cwd(), bundlePath);
                }

                if (fs.existsSync(bundlePath)) {
                    ca = fs.readFileSync(bundlePath);
                    if (isDebug) {
                        console.log(`[soapClient] Loaded CA bundle from: ${bundlePath} (${ca.length} bytes)`);
                    }
                } else {
                    if (isDebug) {
                        console.error(`[soapClient] CA bundle file not found at: ${bundlePath}`);
                    }
                }
            } catch (err: any) {
                console.error(`[SEFAZ] Warn: Failed to load CA from SEFAZ_CA_BUNDLE_PATH: ${process.env.SEFAZ_CA_BUNDLE_PATH}. Error: ${err.message}`);
            }
        }

        // Prepare mTLS Agent
        // For homologation/dev, allow disabling strict SSL to work around ICP-Brasil cert chain issues
        const shouldRejectUnauthorized = process.env.SEFAZ_REJECT_UNAUTHORIZED !== 'false';

        const agent = new https.Agent({
            cert: pfxData.certificatePem,
            key: pfxData.privateKeyPem,
            ca: ca, // If undefined, node uses default system CAs
            rejectUnauthorized: shouldRejectUnauthorized, // Configurable SSL strictness
            keepAlive: true
        });

        // SOAP 1.2ContentType with Action
        const contentType = `application/soap+xml; charset=utf-8; action="${soapAction}"`;

        const reqOptions: https.RequestOptions = {
            method: "POST",
            agent,
            headers: {
                "Content-Type": contentType,
                "Content-Length": Buffer.byteLength(xmlBody)
            },
            timeout: options.timeoutMs || 30000 // default 30s
        };

        // Debug Setup
        let requestId: string = "";
        const debugDir = options.debugDir || "/tmp/desdobra-sefaz";



        // Sanitization helper
        const sanitize = (text: string): string => {
            let sanitized = text;
            // Remove sensitive data patterns
            sanitized = sanitized.replace(/pfxBase64["']?\s*:\s*["'][^"']+["']/gi, 'pfxBase64: "***REDACTED***"');
            sanitized = sanitized.replace(/pfxPassword["']?\s*:\s*["'][^"']+["']/gi, 'pfxPassword: "***REDACTED***"');
            sanitized = sanitized.replace(/password["']?\s*:\s*["'][^"']+["']/gi, 'password: "***REDACTED***"');
            sanitized = sanitized.replace(/SUPABASE_SERVICE_ROLE_KEY["']?\s*:\s*["'][^"']+["']/gi, 'SUPABASE_SERVICE_ROLE_KEY: "***REDACTED***"');
            sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer ***REDACTED***');
            return sanitized;
        };

        if (isDebug) {
            requestId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }

            console.log(`\n[SEFAZ-DIAGNOSTIC] Request ID: ${requestId}`);
            console.log(`Target URL: ${url}`);
            console.log(`Node Version: ${process.version}`);
            console.log(`Exec Path: ${process.execPath}`);
            console.log(`Platform: ${process.platform} (${process.arch})`);
            console.log(`Runtime: ${typeof process.versions.node !== 'undefined' ? 'Node.js' : 'Edge/Other'}`);
            console.log('--- TLS Environment ---');
            console.log(`NODE_EXTRA_CA_CERTS: ${process.env.NODE_EXTRA_CA_CERTS || 'Not set'}`);
            console.log(`NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'Not set'}`);
            console.log(`SEFAZ_CA_BUNDLE_PATH: ${process.env.SEFAZ_CA_BUNDLE_PATH || 'Not set'}`);

            // Log Agent CA details
            if (options.caPem) {
                console.log(`Agent CA: Provided via options (Length: ${options.caPem.length})`);
            } else if (ca) {
                const caLen = Buffer.isBuffer(ca) ? ca.length : ca.length;
                console.log(`Agent CA: Loaded effectively from file/env (Length: ${caLen})`);

                // Deep inspection of the bundle content
                const caStr = ca.toString();
                const firstLine = caStr.split('\n').find(l => l.trim().length > 0) || 'EMPTY';
                const lastLine = caStr.trim().split('\n').pop() || 'EMPTY';
                console.log(`Agent CA Preview: Start="${firstLine.substring(0, 30)}..." End="...${lastLine.substring(lastLine.length - 30)}"`);
            } else {
                console.log(`Agent CA: Using default system store (on most systems)`);
            }

            // Log Headers & SOAP details
            console.log('--- SOAP Request Details ---');
            console.log(`Endpoint URL: ${url}`);
            console.log(`SOAP Action: ${soapAction || 'None'}`);
            console.log(`Headers: ${JSON.stringify(reqOptions.headers, null, 2)}`);
            const inferredVersion = contentType.includes('application/soap+xml') ? '1.2' : '1.1';
            console.log(`Inferred SOAP Version: ${inferredVersion}`);

            console.log(`Agent rejectUnauthorized: ${agent.options.rejectUnauthorized}`);
            console.log('-----------------------\n');

            // Save Request Artifacts (sanitized)
            fs.writeFileSync(path.join(debugDir, `${requestId}.request.soap.xml`), sanitize(xmlBody));

            // Try to extract inner XML (naive regex)
            const innerMatch = xmlBody.match(/<nfeDadosMsg[^>]*>([\s\S]*?)<\/nfeDadosMsg>/);
            if (innerMatch && innerMatch[1]) {
                fs.writeFileSync(path.join(debugDir, `${requestId}.request.inner.xml`), sanitize(innerMatch[1].trim()));
            }
        }

        const req = https.request(url, reqOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                // Debug Response Artifacts (sanitized)
                if (isDebug) {
                    fs.writeFileSync(path.join(debugDir, `${requestId}.response.soap.xml`), sanitize(data));

                    const meta = {
                        requestId,
                        url,
                        method: "POST",
                        httpStatus: res.statusCode,
                        headers: {
                            "content-type": res.headers["content-type"],
                            "user-agent": req.getHeader("user-agent")
                        },
                        timestamp: new Date().toISOString()
                    };
                    fs.writeFileSync(path.join(debugDir, `${requestId}.meta.json`), JSON.stringify(meta, null, 2));

                    // Stdout Log
                    const maxBody = options.debugMaxBodyChars || 5000;
                    const snippet = data.length > maxBody ? data.substring(0, maxBody) + "...(truncated)" : data;

                    console.log(`\n[SEFAZ-DEBUG] ${requestId}`);
                    console.log(`URL: ${url} | Status: ${res.statusCode}`);
                    console.log(`Artifacts: ${debugDir}/${requestId}.*`);
                    console.log(`Response Snippet:\n${snippet}\n`);
                }

                if (res.statusCode && res.statusCode >= 500) {
                    return reject(new NfeSefazError(`Erro HTTP SEFAZ: ${res.statusCode}`, "SOAP", { status: res.statusCode, body: data }));
                }
                resolve({ status: res.statusCode || 200, body: data });
            });
        });

        req.on("error", (err: any) => {
            if (isDebug) {
                console.error(`[SEFAZ-DEBUG] Request Error: ${err.message}`);
            }

            // Specialized TLS Error Handling
            if (err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
                err.code === 'CERT_HAS_EXPIRED' ||
                err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                err.message.includes('certificate')) {

                const tlsError: any = new NfeSefazError(`Erro de conexão segura (TLS/SSL): ${err.message}`, "CERT", err);
                tlsError.details = {
                    code: "SEFAZ_TLS_ERROR",
                    hint: "A cadeia de certificados do servidor SEFAZ não é confiável neste ambiente.",
                    detail: err.message,
                    env: process.env.NODE_ENV,
                    host: new URL(url).hostname
                };
                return reject(tlsError);
            }

            reject(new NfeSefazError(`Erro de conexão SOAP: ${err.message}`, "SOAP", err));
        });

        req.on("timeout", () => {
            req.destroy();
            if (isDebug) {
                console.error(`[SEFAZ-DEBUG] Request Timeout`);
            }
            reject(new NfeSefazError(`Timeout na conexão SEFAZ (${reqOptions.timeout}ms)`, "SOAP"));
        });

        req.write(xmlBody);
        req.end();
    });
}
