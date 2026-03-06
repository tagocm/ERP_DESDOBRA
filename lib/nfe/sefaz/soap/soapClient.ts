import https from "https";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NfeSefazError } from "../errors";
import { parsePfx } from "@/lib/nfe/sign/cert";
import { SefazCertConfig, SefazRequestOptions } from "../types";
import { logger } from "@/lib/logger";

type EndpointInfo = {
  hostname: string;
  path: string;
  service: string;
};

type RequestAttempt = "primary" | "system-fallback";
type EffectiveCaSource = "custom-bundle" | "system-trust-store" | "node-extra-ca-certs";

type EffectiveCaConfig = {
  ca?: string | Buffer;
  source: EffectiveCaSource;
  ignoredCustomCaForDistribution: boolean;
};

export type ResolvedCaBundle = {
  ca?: string | Buffer;
  source: "options" | "env" | "none";
  resolvedPath?: string;
  sizeBytes?: number;
  sha256?: string;
  certificateCount?: number;
};

type ParsedPfx = {
  certificatePem: string;
  privateKeyPem: string;
};

export class SEFAZNetworkDisabledError extends NfeSefazError {
  constructor(args: {
    host: string;
    path: string;
    service: string;
    jobId?: string;
    companyId?: string;
    environment?: string;
  }) {
    super(
      `Bloqueado por configuração: SEFAZ_NETWORK_DISABLED=true (${args.host}${args.path})`,
      "SOAP",
      {
        code: "SEFAZ_NETWORK_DISABLED",
        ...args,
      },
    );
    this.name = "SEFAZNetworkDisabledError";
  }
}

const TLS_ERROR_CODES = new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Error";
}

function toErrnoException(error: unknown): NodeJS.ErrnoException {
  if (error && typeof error === "object") {
    return error as NodeJS.ErrnoException;
  }
  return new Error(toErrorMessage(error)) as NodeJS.ErrnoException;
}

function getServiceFromSoapAction(soapAction: string): string | null {
  const wsdlMatch = /\/wsdl\/([^/]+)/i.exec(soapAction);
  if (wsdlMatch?.[1]) return wsdlMatch[1];

  const actionParts = soapAction.split("/").filter(Boolean);
  if (actionParts.length > 0) {
    return actionParts[actionParts.length - 1] || null;
  }

  return null;
}

export function parseEndpointInfo(url: string, soapAction: string): EndpointInfo {
  const parsed = new URL(url);
  const serviceFromAction = getServiceFromSoapAction(soapAction);
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const serviceFromPath = pathParts.length > 0 ? pathParts[0] : "unknown";

  return {
    hostname: parsed.hostname,
    path: parsed.pathname,
    service: serviceFromAction || serviceFromPath,
  };
}

function countPemCertificates(content: string): number {
  return (content.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
}

function resolveSystemCaSource(): EffectiveCaSource {
  return process.env.NODE_EXTRA_CA_CERTS ? "node-extra-ca-certs" : "system-trust-store";
}

function shouldIgnoreEnvBundleForDistribution(endpoint: EndpointInfo, caBundle: ResolvedCaBundle): boolean {
  if (caBundle.source !== "env") return false;
  if (endpoint.service !== "NFeDistribuicaoDFe") return false;
  return /(^|\.)nfe\.fazenda\.gov\.br$/i.test(endpoint.hostname);
}

export function resolveEffectiveCaConfig(args: {
  endpoint: EndpointInfo;
  caBundle: ResolvedCaBundle;
  useSystemCa: boolean;
}): EffectiveCaConfig {
  if (args.useSystemCa) {
    return {
      ca: undefined,
      source: resolveSystemCaSource(),
      ignoredCustomCaForDistribution: false,
    };
  }

  if (shouldIgnoreEnvBundleForDistribution(args.endpoint, args.caBundle)) {
    return {
      ca: undefined,
      source: resolveSystemCaSource(),
      ignoredCustomCaForDistribution: true,
    };
  }

  if (args.caBundle.ca) {
    return {
      ca: args.caBundle.ca,
      source: "custom-bundle",
      ignoredCustomCaForDistribution: false,
    };
  }

  return {
    ca: undefined,
    source: resolveSystemCaSource(),
    ignoredCustomCaForDistribution: false,
  };
}

function isTlsCertificateError(error: NodeJS.ErrnoException): boolean {
  const message = String(error.message ?? "").toLowerCase();
  return TLS_ERROR_CODES.has(String(error.code ?? "")) || message.includes("certificate");
}

function sanitize(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(/pfxBase64["']?\s*:\s*["'][^"']+["']/gi, 'pfxBase64: "***REDACTED***"');
  sanitized = sanitized.replace(/pfxPassword["']?\s*:\s*["'][^"']+["']/gi, 'pfxPassword: "***REDACTED***"');
  sanitized = sanitized.replace(/password["']?\s*:\s*["'][^"']+["']/gi, 'password: "***REDACTED***"');
  sanitized = sanitized.replace(
    /SUPABASE_SERVICE_ROLE_KEY["']?\s*:\s*["'][^"']+["']/gi,
    'SUPABASE_SERVICE_ROLE_KEY: "***REDACTED***"',
  );
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, "Bearer ***REDACTED***");
  return sanitized;
}

export function resolveSefazCaBundle(options: Pick<SefazRequestOptions, "caPem"> = {}): ResolvedCaBundle {
  if (options.caPem) {
    const raw = Buffer.isBuffer(options.caPem) ? options.caPem : Buffer.from(options.caPem, "utf8");
    const certificateCount = countPemCertificates(raw.toString("utf8"));
    return {
      ca: options.caPem,
      source: "options",
      sizeBytes: raw.length,
      sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      certificateCount,
    };
  }

  const envBundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;
  if (!envBundlePath) {
    return { source: "none" };
  }

  const resolvedPath = path.isAbsolute(envBundlePath)
    ? envBundlePath
    : path.resolve(process.cwd(), envBundlePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new NfeSefazError(
      `SEFAZ_CA_BUNDLE_PATH configurado, mas arquivo não encontrado: ${resolvedPath}`,
      "CERT",
    );
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
    const content = fs.readFileSync(resolvedPath);
    const certificateCount = countPemCertificates(content.toString("utf8"));

    if (certificateCount < 1) {
      throw new NfeSefazError(
        `SEFAZ_CA_BUNDLE_PATH inválido (${resolvedPath}): nenhum certificado PEM encontrado.`,
        "CERT",
      );
    }

    return {
      ca: content,
      source: "env",
      resolvedPath,
      sizeBytes: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      certificateCount,
    };
  } catch (error) {
    if (error instanceof NfeSefazError) {
      throw error;
    }

    throw new NfeSefazError(
      `Falha ao ler SEFAZ_CA_BUNDLE_PATH (${resolvedPath}): ${toErrorMessage(error)}`,
      "CERT",
    );
  }
}

export function createSoapHttpsAgent(args: {
  certificatePem: string;
  privateKeyPem: string;
  ca?: string | Buffer;
  rejectUnauthorized: boolean;
}): https.Agent {
  return new https.Agent({
    cert: args.certificatePem,
    key: args.privateKeyPem,
    ca: args.ca,
    rejectUnauthorized: args.rejectUnauthorized,
    keepAlive: true,
  });
}

export async function soapRequest(
  url: string,
  soapAction: string,
  xmlBody: string,
  certConfig: SefazCertConfig,
  options: SefazRequestOptions = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let pfxData: ParsedPfx;
    const isDebug = Boolean(options.debug) || process.env.SEFAZ_DEBUG === "true";
    const endpoint = parseEndpointInfo(url, soapAction);

    try {
      pfxData = parsePfx(certConfig.pfxBase64, certConfig.pfxPassword) as ParsedPfx;
    } catch (error) {
      const parsedError = toErrnoException(error);
      const msg = String(parsedError.message || "").toLowerCase();
      let hint = "UNKNOWN";

      if (msg.includes("bad decrypt") || msg.includes("mac verify failure") || msg.includes("invalid password")) {
        hint = "PFX_PASSWORD_INVALID";
      } else if (msg.includes("no start line") || msg.includes("wrong tag") || msg.includes("asn1")) {
        hint = "PFX_CORRUPT_OR_WRONG_ENCODING";
      } else if (process.version && !process.version.startsWith("v")) {
        hint = "EDGE_RUNTIME_DETECTED";
      }

      const diagnosticInfo = {
        timestamp: new Date().toISOString(),
        errorName: parsedError.name,
        errorMessage: parsedError.message,
        errorCode: parsedError.code,
        hint,
        pfxByteLength: certConfig.pfxBase64 ? Buffer.from(certConfig.pfxBase64, "base64").length : 0,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      logger.error("[soapClient] PFX Parse Error", diagnosticInfo);

      const structuredError = new NfeSefazError("Erro ao processar certificado para mTLS", "CERT", parsedError);
      structuredError.details = {
        code: "CERT_MTLS_FAILED",
        hint,
        detail: parsedError.message,
        pfxByteLength: diagnosticInfo.pfxByteLength,
      };
      reject(structuredError);
      return;
    }

    let caBundle: ResolvedCaBundle;
    try {
      caBundle = resolveSefazCaBundle({ caPem: options.caPem });
    } catch (error) {
      reject(error);
      return;
    }

    const isProduction = process.env.NODE_ENV === "production";
    let requestedRejectUnauthorized = process.env.SEFAZ_REJECT_UNAUTHORIZED !== "false";

    if (!isProduction && process.env.SEFAZ_REJECT_UNAUTHORIZED === undefined && process.platform === "darwin") {
      requestedRejectUnauthorized = false;
      if (isDebug) {
        logger.info("[SEFAZ] Auto-disabling rejectUnauthorized for macOS development environment.");
      }
    }

    const shouldRejectUnauthorized = isProduction ? true : requestedRejectUnauthorized;
    if (isProduction && !requestedRejectUnauthorized) {
      logger.warn("[SEFAZ] Ignoring SEFAZ_REJECT_UNAUTHORIZED=false in production.");
    }

    const contentType = `application/soap+xml; charset=utf-8; action="${soapAction}"`;
    const debugDirRaw = options.debugDir || process.env.SEFAZ_DEBUG_DIR;
    const debugDir = debugDirRaw
      ? path.isAbsolute(debugDirRaw)
        ? debugDirRaw
        : path.resolve(process.cwd(), debugDirRaw)
      : undefined;
    const allowDebugFilesInProd = process.env.SEFAZ_DEBUG_ALLOW_PROD === "true";
    const shouldWriteDebugFiles = Boolean(debugDir) && (process.env.NODE_ENV !== "production" || allowDebugFilesInProd);
    const requestId = isDebug ? `${Date.now()}-${crypto.randomBytes(4).toString("hex")}` : "";
    const allowSystemCaFallback = options.allowSystemCaFallback !== false;
    const networkDisabled = String(process.env.SEFAZ_NETWORK_DISABLED ?? "").toLowerCase() === "true";

    if (isDebug) {
      if (shouldWriteDebugFiles && debugDir && !fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      logger.info(`\n[SEFAZ-DIAGNOSTIC] Request ID: ${requestId}`);
      logger.info(
        `[SEFAZ-DIAGNOSTIC] Endpoint host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service}`,
      );
      logger.info(`Target URL: ${url}`);
      logger.info(`SOAP Action: ${soapAction || "None"}`);
      logger.info(`SEFAZ_CA_BUNDLE_PATH: ${process.env.SEFAZ_CA_BUNDLE_PATH || "Not set"}`);

      if (caBundle.source === "env") {
        logger.info(
          `[SEFAZ-DIAGNOSTIC] Agent CA source=env path=${caBundle.resolvedPath} bytes=${caBundle.sizeBytes} certs=${caBundle.certificateCount} sha256=${caBundle.sha256}`,
        );
      } else if (caBundle.source === "options") {
        logger.info(
          `[SEFAZ-DIAGNOSTIC] Agent CA source=options bytes=${caBundle.sizeBytes} certs=${caBundle.certificateCount} sha256=${caBundle.sha256}`,
        );
      } else {
        logger.info("[SEFAZ-DIAGNOSTIC] Agent CA source=system-default");
      }
    }

    const writeDebugFile = (filename: string, body: string): void => {
      if (!shouldWriteDebugFiles || !debugDir) return;
      fs.writeFileSync(path.join(debugDir, filename), body);
    };

    const dispatchRequest = (attempt: RequestAttempt, useSystemCa: boolean): void => {
      if (networkDisabled) {
        const context = options.context;
        logger.error(
          `[SEFAZ-BLOCK] jobId=${context?.jobId ?? "-"} companyId=${context?.companyId ?? "-"} host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service} reason=SEFAZ_NETWORK_DISABLED`,
        );
        reject(
          new SEFAZNetworkDisabledError({
            host: endpoint.hostname,
            path: endpoint.path,
            service: endpoint.service,
            jobId: context?.jobId,
            companyId: context?.companyId,
            environment: context?.environment,
          }),
        );
        return;
      }

      const effectiveCa = resolveEffectiveCaConfig({
        endpoint,
        caBundle,
        useSystemCa,
      });
      const activeCa = effectiveCa.ca;
      const usingCustomCa = Boolean(activeCa);

      if (isDebug && effectiveCa.ignoredCustomCaForDistribution) {
        logger.warn(
          `[SEFAZ-DIAGNOSTIC] Ignorando SEFAZ_CA_BUNDLE_PATH para ${endpoint.service} (${endpoint.hostname}); usando trust store do sistema.`,
        );
      }

      const agent = createSoapHttpsAgent({
        certificatePem: pfxData.certificatePem,
        privateKeyPem: pfxData.privateKeyPem,
        ca: activeCa,
        rejectUnauthorized: shouldRejectUnauthorized,
      });

      const reqOptions: https.RequestOptions = {
        method: "POST",
        agent,
        headers: {
          "Content-Type": contentType,
          "Content-Length": Buffer.byteLength(xmlBody),
        },
        timeout: options.timeoutMs || 30000,
      };

      if (isDebug) {
        const sourceSuffix =
          effectiveCa.source === "custom-bundle"
            ? ` bundlePath=${caBundle.resolvedPath ?? "-"} bundleSha256=${caBundle.sha256 ?? "-"} bundleCerts=${String(caBundle.certificateCount ?? 0)}`
            : effectiveCa.source === "node-extra-ca-certs"
              ? ` nodeExtraCaCerts=${process.env.NODE_EXTRA_CA_CERTS ?? "-"}`
              : "";
        logger.info(
          `[SEFAZ-DIAGNOSTIC] Attempt=${attempt} host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service} caSource=${effectiveCa.source}${sourceSuffix} rejectUnauthorized=${String(agent.options.rejectUnauthorized)}`,
        );
        logger.info(`Headers: ${JSON.stringify(reqOptions.headers, null, 2)}`);
        writeDebugFile(`${requestId}.${attempt}.request.soap.xml`, sanitize(xmlBody));

        const innerMatch = xmlBody.match(/<nfeDadosMsg[^>]*>([\s\S]*?)<\/nfeDadosMsg>/);
        if (innerMatch?.[1]) {
          writeDebugFile(`${requestId}.${attempt}.request.inner.xml`, sanitize(innerMatch[1].trim()));
        }
      }

      const req = https.request(url, reqOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (isDebug) {
            const meta = {
              requestId,
              attempt,
              host: endpoint.hostname,
              path: endpoint.path,
              service: endpoint.service,
              httpStatus: res.statusCode,
              timestamp: new Date().toISOString(),
            };
            writeDebugFile(`${requestId}.${attempt}.response.soap.xml`, sanitize(data));
            writeDebugFile(`${requestId}.${attempt}.meta.json`, JSON.stringify(meta, null, 2));

            const maxBody = options.debugMaxBodyChars || 5000;
            const snippet =
              data.length > maxBody ? `${data.substring(0, maxBody)}...(truncated)` : data;
            logger.info(`\n[SEFAZ-DEBUG] ${requestId} attempt=${attempt}`);
            logger.info(
              `Endpoint: host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service} status=${res.statusCode}`,
            );
            if (shouldWriteDebugFiles && debugDir) {
              logger.info(`Artifacts: ${debugDir}/${requestId}.${attempt}.*`);
            }
            logger.info(`Response Snippet:\n${snippet}\n`);
          }

          if (res.statusCode && res.statusCode >= 500) {
            reject(new NfeSefazError(`Erro HTTP SEFAZ: ${res.statusCode}`, "SOAP", { status: res.statusCode, body: data }));
            return;
          }

          resolve({ status: res.statusCode || 200, body: data });
        });
      });

      req.on("error", (requestError: unknown) => {
        const parsedError = toErrnoException(requestError);
        const message = toErrorMessage(parsedError);
        const tlsError = isTlsCertificateError(parsedError);

        if (isDebug) {
          logger.error(
            `[SEFAZ-DEBUG] Request Error attempt=${attempt} host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service} code=${String(parsedError.code || "")}: ${message}`,
          );
        }

        if (tlsError && attempt === "primary" && caBundle.source === "env" && usingCustomCa && allowSystemCaFallback) {
          logger.warn(
            `[SEFAZ] TLS falhou com CA customizado; tentando fallback para trust store do sistema (host=${endpoint.hostname}, path=${endpoint.path}, service=${endpoint.service}, bundle=${caBundle.resolvedPath}, sha256=${caBundle.sha256})`,
          );
          dispatchRequest("system-fallback", true);
          return;
        }

        if (tlsError) {
          const tlsWrappedError = new NfeSefazError(`Erro de conexão segura (TLS/SSL): ${message}`, "CERT", parsedError);
          tlsWrappedError.details = {
            code: "SEFAZ_TLS_ERROR",
            hint: "A cadeia de certificados do servidor SEFAZ não é confiável neste ambiente.",
            detail: message,
            env: process.env.NODE_ENV,
            host: endpoint.hostname,
            path: endpoint.path,
            service: endpoint.service,
            attempt,
          };
          reject(tlsWrappedError);
          return;
        }

        reject(new NfeSefazError(`Erro de conexão SOAP: ${message}`, "SOAP", parsedError));
      });

      req.on("timeout", () => {
        req.destroy();
        if (isDebug) {
          logger.error(
            `[SEFAZ-DEBUG] Request Timeout attempt=${attempt} host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service}`,
          );
        }
        reject(new NfeSefazError(`Timeout na conexão SEFAZ (${reqOptions.timeout}ms)`, "SOAP"));
      });

      req.write(xmlBody);
      req.end();
    };

    dispatchRequest("primary", false);
  });
}
