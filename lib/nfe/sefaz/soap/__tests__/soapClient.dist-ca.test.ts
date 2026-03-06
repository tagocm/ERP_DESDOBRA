import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { soapRequest } from "../soapClient";

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

const { parsePfxMock } = vi.hoisted(() => ({
  parsePfxMock: vi.fn(),
}));

vi.mock("@/lib/nfe/sign/cert", () => ({
  parsePfx: parsePfxMock,
}));

class MockTlsErrorRequest extends EventEmitter {
  private readonly tlsError: NodeJS.ErrnoException;

  constructor(tlsError: NodeJS.ErrnoException) {
    super();
    this.tlsError = tlsError;
  }

  write(_chunk: string): boolean {
    return true;
  }

  end(): this {
    process.nextTick(() => {
      this.emit("error", this.tlsError);
    });
    return this;
  }

  destroy(_error?: Error): this {
    return this;
  }
}

function createTempBundle(content: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "soap-client-dist-ca-"));
  const bundlePath = path.join(tempDir, "bundle.pem");
  fs.writeFileSync(bundlePath, content, "utf8");
  return bundlePath;
}

describe("soapRequest CA policy for NFeDistribuicaoDFe", () => {
  const originalBundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;
  const originalDebug = process.env.SEFAZ_DEBUG;
  const createdPaths: string[] = [];

  beforeEach(() => {
    parsePfxMock.mockReset();
    parsePfxMock.mockReturnValue({
      certificatePem: "CERTIFICATE_PEM",
      privateKeyPem: "PRIVATE_KEY_PEM",
    });
    process.env.SEFAZ_DEBUG = "true";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createdPaths.splice(0).forEach((bundlePath) => {
      fs.rmSync(path.dirname(bundlePath), { recursive: true, force: true });
    });
    if (typeof originalBundlePath === "string") {
      process.env.SEFAZ_CA_BUNDLE_PATH = originalBundlePath;
    } else {
      delete process.env.SEFAZ_CA_BUNDLE_PATH;
    }
    if (typeof originalDebug === "string") {
      process.env.SEFAZ_DEBUG = originalDebug;
    } else {
      delete process.env.SEFAZ_DEBUG;
    }
  });

  it("usa trust store do sistema e não executa fallback extra em erro TLS", async () => {
    const bundlePath = createTempBundle(SAMPLE_CA_BUNDLE);
    createdPaths.push(bundlePath);
    process.env.SEFAZ_CA_BUNDLE_PATH = bundlePath;

    const tlsError = Object.assign(new Error("unable to get local issuer certificate"), {
      code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    }) as NodeJS.ErrnoException;

    const requestSpy = vi
      .spyOn(https, "request")
      .mockImplementation(((...args: Parameters<typeof https.request>) => {
        const maybeCallback = args[2];
        if (typeof maybeCallback === "function") {
          // Não chamamos callback porque simulamos falha TLS antes de resposta HTTP.
        }
        return new MockTlsErrorRequest(tlsError) as unknown as ReturnType<typeof https.request>;
      }) as typeof https.request);

    await expect(
      soapRequest(
        "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
        "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
        "<soap/>",
        {
          pfxBase64: "ZmFrZS1wZng=",
          pfxPassword: "123456",
        },
      ),
    ).rejects.toThrow(/Erro de conexão segura/);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const secondArg = requestSpy.mock.calls[0]?.[1];
    const requestOptions =
      secondArg && typeof secondArg === "object" ? (secondArg as https.RequestOptions) : undefined;
    const agent = requestOptions?.agent as https.Agent | undefined;
    expect(agent?.options.ca).toBeUndefined();
  });
});
