import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { SEFAZNetworkDisabledError, soapRequest } from "../soapClient";

const { parsePfxMock } = vi.hoisted(() => ({
  parsePfxMock: vi.fn(),
}));

vi.mock("@/lib/nfe/sign/cert", () => ({
  parsePfx: parsePfxMock,
}));

describe("soapRequest network hard disable", () => {
  const originalNetworkDisabled = process.env.SEFAZ_NETWORK_DISABLED;
  const originalBundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;

  beforeEach(() => {
    process.env.SEFAZ_NETWORK_DISABLED = "true";
    delete process.env.SEFAZ_CA_BUNDLE_PATH;
    parsePfxMock.mockReset();
    parsePfxMock.mockReturnValue({
      certificatePem: "CERTIFICATE_PEM",
      privateKeyPem: "PRIVATE_KEY_PEM",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof originalNetworkDisabled === "string") {
      process.env.SEFAZ_NETWORK_DISABLED = originalNetworkDisabled;
    } else {
      delete process.env.SEFAZ_NETWORK_DISABLED;
    }

    if (typeof originalBundlePath === "string") {
      process.env.SEFAZ_CA_BUNDLE_PATH = originalBundlePath;
    } else {
      delete process.env.SEFAZ_CA_BUNDLE_PATH;
    }
  });

  it("bloqueia request antes da rede, sem fallback e com log SEFAZ-BLOCK", async () => {
    const requestSpy = vi.spyOn(https, "request");
    const logSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    await expect(
      soapRequest(
        "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
        "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
        "<soap/>",
        {
          pfxBase64: "ZmFrZS1wZng=",
          pfxPassword: "123456",
        },
        {
          context: {
            jobId: "11111111-1111-1111-1111-111111111111",
            companyId: "22222222-2222-2222-2222-222222222222",
            environment: "production",
          },
        },
      ),
    ).rejects.toBeInstanceOf(SEFAZNetworkDisabledError);

    expect(requestSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[SEFAZ-BLOCK] jobId=11111111-1111-1111-1111-111111111111 companyId=22222222-2222-2222-2222-222222222222 host=www1.nfe.fazenda.gov.br path=/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx service=NFeDistribuicaoDFe reason=SEFAZ_NETWORK_DISABLED",
      ),
    );
  });
});
