import { beforeEach, describe, expect, it, vi } from "vitest";
import { Job, JobWorker } from "@/lib/queue/worker";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createAdminClient: createAdminClientMock,
}));

type UpdateCall = {
  status: "pending" | "processing" | "completed" | "failed";
  updated_at: string;
  last_error?: string;
  scheduled_for?: string;
  attempts?: number;
};

type UpdateBuilder = {
  eq: (column: string, value: string) => Promise<{ error: null }>;
};

type SupabaseUpdateTable = {
  update: (payload: UpdateCall) => UpdateBuilder;
};

type SupabaseMock = {
  from: (table: string) => SupabaseUpdateTable;
};

type WorkerPrivateApi = {
  processJob: (job: Job) => Promise<void>;
  handleJobLogic: (job: Job) => Promise<void>;
};

function buildJob(jobType: string): Job {
  return {
    id: "7ee0bf75-8da5-4c96-a082-d1cccae75c84",
    job_type: jobType,
    payload: {},
    status: "processing",
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    created_at: "2026-03-06T10:00:00.000Z",
    updated_at: "2026-03-06T10:00:00.000Z",
    scheduled_for: "2026-03-06T10:00:00.000Z",
  };
}

describe("JobWorker retry policy for NFE_DFE_DIST_SYNC", () => {
  let updatePayloads: UpdateCall[];

  beforeEach(() => {
    updatePayloads = [];

    const update = (payload: UpdateCall): UpdateBuilder => {
      updatePayloads.push(payload);
      return {
        eq: async () => ({ error: null }),
      };
    };

    const supabaseMock: SupabaseMock = {
      from: () => ({
        update,
      }),
    };

    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(supabaseMock);
  });

  it("marca NFE_DFE_DIST_SYNC como failed em 1 tentativa sem relançar no loop", async () => {
    const worker = new JobWorker({ jobType: "NFE_DFE_DIST_SYNC" });
    const internals = worker as unknown as WorkerPrivateApi;
    vi.spyOn(internals, "handleJobLogic").mockRejectedValue(
      new Error("Erro de conexão segura (TLS/SSL): unable to get local issuer certificate"),
    );

    await expect(internals.processJob(buildJob("NFE_DFE_DIST_SYNC"))).resolves.toBeUndefined();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]?.status).toBe("failed");
    expect(updatePayloads[0]?.attempts).toBe(3);
    expect(updatePayloads[0]?.last_error).toContain("unable to get local issuer certificate");
  });

  it("mantém retry padrão para outros jobs", async () => {
    const worker = new JobWorker({ jobType: "NFE_EMIT" });
    const internals = worker as unknown as WorkerPrivateApi;
    vi.spyOn(internals, "handleJobLogic").mockRejectedValue(new Error("falha transitória"));

    await expect(internals.processJob(buildJob("NFE_EMIT"))).rejects.toThrow("falha transitória");
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]?.status).toBe("pending");
    expect(updatePayloads[0]?.last_error).toBe("falha transitória");
    expect(updatePayloads[0]?.attempts).toBeUndefined();
  });
});
