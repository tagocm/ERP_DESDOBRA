import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DfeProvider } from "@/lib/fiscal/inbound/provider";
import { processDfeDistSyncJob } from "@/lib/fiscal/inbound/sync-worker";

const { createAdminClientMock, createDfeProviderMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createDfeProviderMock: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/fiscal/inbound/provider", () => ({
  createDfeProvider: createDfeProviderMock,
}));

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

type AdminClientMock = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

const VALID_PAYLOAD = {
  companyId: "11111111-1111-4111-8111-111111111111",
  environment: "production" as const,
  source: "manual" as const,
  requestedBy: null,
};

const JOB_ID = "22222222-2222-4222-8222-222222222222";

function buildProviderResult(nsu: string, hasMore: boolean) {
  return {
    maxNsu: nsu,
    hasMore,
    docs: [
      {
        nsu,
        schema: "resNFe",
        chnfe: null,
        emitCnpj: null,
        emitNome: null,
        destCnpj: null,
        dhEmi: null,
        total: null,
        summaryJson: {},
        xmlBase64: null,
        xmlIsGz: false,
        hasFullXml: false,
        manifestStatus: "SEM_MANIFESTACAO" as const,
        manifestUpdatedAt: null,
      },
    ],
  };
}

describe("processDfeDistSyncJob single-shot mode", () => {
  const originalSingleShot = process.env.NFE_DFE_DIST_SINGLE_SHOT;
  let rpcCalls: RpcCall[] = [];

  afterEach(() => {
    vi.clearAllMocks();
    if (typeof originalSingleShot === "string") {
      process.env.NFE_DFE_DIST_SINGLE_SHOT = originalSingleShot;
    } else {
      delete process.env.NFE_DFE_DIST_SINGLE_SHOT;
    }
  });

  beforeEach(() => {
    rpcCalls = [];
    const adminClient: AdminClientMock = {
      rpc: async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
        rpcCalls.push({ fn, args });

        if (fn === "set_dfe_sync_running") {
          return {
            data: {
              last_nsu: "0",
            },
            error: null,
          };
        }

        if (fn === "upsert_inbound_dfe_batch") {
          return {
            data: {
              inserted_count: 1,
              updated_count: 0,
            },
            error: null,
          };
        }

        if (fn === "set_dfe_sync_result") {
          return {
            data: {
              last_nsu: String(args.p_last_nsu ?? "0"),
            },
            error: null,
          };
        }

        return {
          data: null,
          error: null,
        };
      },
    };

    createAdminClientMock.mockReturnValue(adminClient);
    createAdminClientMock.mockImplementation(() => adminClient);
  });

  it("faz apenas uma consulta quando NFE_DFE_DIST_SINGLE_SHOT=true", async () => {
    process.env.NFE_DFE_DIST_SINGLE_SHOT = "true";

    const fetchByNsuMock = vi.fn();
    fetchByNsuMock.mockResolvedValue(buildProviderResult("1", true));
    const sendManifestMock = vi.fn(async () => ({ protocol: null, receipt: null }));

    createDfeProviderMock.mockReturnValue({
      fetchByNsu: fetchByNsuMock as DfeProvider["fetchByNsu"],
      sendManifest: sendManifestMock as DfeProvider["sendManifest"],
    } satisfies DfeProvider);

    await processDfeDistSyncJob(VALID_PAYLOAD, JOB_ID);

    expect(fetchByNsuMock).toHaveBeenCalledTimes(1);

    const finishCall = rpcCalls.find((call) => call.fn === "set_dfe_sync_result");
    expect(finishCall?.args.p_last_nsu).toBe("1");
    expect(finishCall?.args.p_status).toBe("IDLE");
  });

  it("mantém paginação normal quando NFE_DFE_DIST_SINGLE_SHOT está desligado", async () => {
    delete process.env.NFE_DFE_DIST_SINGLE_SHOT;

    const fetchByNsuMock = vi.fn();
    fetchByNsuMock
      .mockResolvedValueOnce(buildProviderResult("1", true))
      .mockResolvedValueOnce(buildProviderResult("2", false));
    const sendManifestMock = vi.fn(async () => ({ protocol: null, receipt: null }));

    createDfeProviderMock.mockReturnValue({
      fetchByNsu: fetchByNsuMock as DfeProvider["fetchByNsu"],
      sendManifest: sendManifestMock as DfeProvider["sendManifest"],
    } satisfies DfeProvider);

    await processDfeDistSyncJob(VALID_PAYLOAD, JOB_ID);

    expect(fetchByNsuMock).toHaveBeenCalledTimes(2);
  });
});
