import dotenv from "dotenv";
import https from "node:https";
import crypto from "node:crypto";
import { parseEndpointInfo, resolveEffectiveCaConfig, resolveSefazCaBundle } from "../lib/nfe/sefaz/soap/soapClient";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const DIST_URL =
  process.env.SEFAZ_DIST_URL ??
  "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const DIST_SOAP_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";

function normalizeUrlForWsdl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (!parsed.searchParams.has("wsdl")) {
    parsed.searchParams.set("wsdl", "");
  }
  return parsed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Error";
}

async function main(): Promise<void> {
  const endpoint = parseEndpointInfo(DIST_URL, DIST_SOAP_ACTION);
  const caBundle = resolveSefazCaBundle();
  const effectiveCa = resolveEffectiveCaConfig({
    endpoint,
    caBundle,
    useSystemCa: false,
  });
  const requestUrl = normalizeUrlForWsdl(DIST_URL);

  console.log("[SEFAZ-DIST-DIAG] Starting diagnostic");
  console.log(`[SEFAZ-DIST-DIAG] node=${process.version} openssl=${process.versions.openssl}`);
  console.log(`[SEFAZ-DIST-DIAG] host=${endpoint.hostname} path=${endpoint.path} service=${endpoint.service}`);
  console.log(`[SEFAZ-DIST-DIAG] caSource=${effectiveCa.source}`);
  if (effectiveCa.source === "custom-bundle") {
    console.log(
      `[SEFAZ-DIST-DIAG] bundlePath=${caBundle.resolvedPath ?? "-"} bundleCerts=${String(caBundle.certificateCount ?? 0)} bundleSha256=${caBundle.sha256 ?? "-"}`,
    );
  }
  if (effectiveCa.source === "node-extra-ca-certs") {
    const nodeExtraPath = process.env.NODE_EXTRA_CA_CERTS ?? "-";
    const hash = crypto
      .createHash("sha256")
      .update(Buffer.from(nodeExtraPath, "utf8"))
      .digest("hex");
    console.log(`[SEFAZ-DIST-DIAG] nodeExtraCaCerts=${nodeExtraPath} refSha256=${hash}`);
  }

  const agent = new https.Agent({
    ca: effectiveCa.ca,
    rejectUnauthorized: true,
    keepAlive: false,
  });

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      requestUrl,
      {
        method: "GET",
        agent,
        timeout: 15000,
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          console.log(`[SEFAZ-DIST-DIAG] success status=${res.statusCode ?? 0} bodyBytes=${responseBody.length}`);
          resolve();
        });
      },
    );

    req.on("error", (error: NodeJS.ErrnoException) => {
      console.error(`[SEFAZ-DIST-DIAG] fail code=${String(error.code ?? "-")} message=${toErrorMessage(error)}`);
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.end();
  });
}

main().catch((error) => {
  console.error(`[SEFAZ-DIST-DIAG] fatal ${toErrorMessage(error)}`);
  process.exitCode = 1;
});
