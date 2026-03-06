import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSoapHttpsAgent, resolveSefazCaBundle } from "../soapClient";

const SAMPLE_CA_BUNDLE = `-----BEGIN CERTIFICATE-----
MIIBkDCCATagAwIBAgIUFxVdX5+f5+f5+f5+f5+f5+f5+f0wCgYIKoZIzj0EAwIw
EjEQMA4GA1UEAwwHRGVtbyBDQTAeFw0yNjAzMDYwMDAwMDBaFw0zNjAzMDMwMDAw
MDBaMBIxEDAOBgNVBAMMB0RlbW8gQ0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AATzZ2Qx6f8r8r5f2nq0dX5jJmZt9fU6W0X1Oq7v8Jj3qkYgH3I5v3N3Yc9Qj0f2
Iv4Q2GJ6pUQxJx4o0nE4WzQwo1MwUTAdBgNVHQ4EFgQUg9l3kXq+3m9X9W1x9g5R
YV0s9KswHwYDVR0jBBgwFoAUg9l3kXq+3m9X9W1x9g5RYV0s9KswDwYDVR0TAQH/
BAUwAwEB/zAKBggqhkjOPQQDAgNHADBEAiA9jN2F2oYJ5kQ7m6fY8m+QmW6j8mJf
2kG0dLkR5l6J9AIgK2p0Nf8v7x3fYw8m6Jb6l7v0mV9Qx8uQ2c3d4e5f6gA=
-----END CERTIFICATE-----
`;

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIB
-----END CERTIFICATE-----`;

const SAMPLE_KEY = `-----BEGIN PRIVATE KEY-----
MIIE
-----END PRIVATE KEY-----`;

let originalBundlePath: string | undefined;
const createdDirs: string[] = [];

function createTempFile(content: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "soap-client-ca-"));
  createdDirs.push(tempDir);
  const filePath = path.join(tempDir, "bundle.pem");
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

beforeEach(() => {
  originalBundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;
  delete process.env.SEFAZ_CA_BUNDLE_PATH;
});

afterEach(() => {
  if (typeof originalBundlePath === "string") {
    process.env.SEFAZ_CA_BUNDLE_PATH = originalBundlePath;
  } else {
    delete process.env.SEFAZ_CA_BUNDLE_PATH;
  }

  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveSefazCaBundle", () => {
  it("carrega bundle do SEFAZ_CA_BUNDLE_PATH e aplica no agent TLS", () => {
    const bundlePath = createTempFile(SAMPLE_CA_BUNDLE);
    process.env.SEFAZ_CA_BUNDLE_PATH = bundlePath;

    const resolved = resolveSefazCaBundle();
    expect(resolved.source).toBe("env");
    expect(resolved.resolvedPath).toBe(bundlePath);
    expect(resolved.sizeBytes).toBeGreaterThan(0);
    expect(resolved.certificateCount).toBeGreaterThanOrEqual(1);
    expect(resolved.sha256).toMatch(/^[a-f0-9]{64}$/);

    const agent = createSoapHttpsAgent({
      certificatePem: SAMPLE_CERT,
      privateKeyPem: SAMPLE_KEY,
      ca: resolved.ca,
      rejectUnauthorized: true,
    });

    const agentCa = agent.options.ca;
    const serializedCa = Array.isArray(agentCa)
      ? agentCa.map((entry) => (Buffer.isBuffer(entry) ? entry.toString("utf8") : String(entry))).join("\n")
      : Buffer.isBuffer(agentCa)
        ? agentCa.toString("utf8")
        : String(agentCa ?? "");

    expect(serializedCa).toContain("BEGIN CERTIFICATE");
  });

  it("falha rápido quando caminho do bundle é inválido", () => {
    process.env.SEFAZ_CA_BUNDLE_PATH = "/tmp/does-not-exist-sefaz-ca.pem";
    expect(() => resolveSefazCaBundle()).toThrowError(/arquivo não encontrado/);
  });

  it("falha rápido quando bundle não contém bloco PEM", () => {
    const invalidBundle = createTempFile("not-a-certificate");
    process.env.SEFAZ_CA_BUNDLE_PATH = invalidBundle;
    expect(() => resolveSefazCaBundle()).toThrowError(/nenhum certificado PEM encontrado/);
  });
});
