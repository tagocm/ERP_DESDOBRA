import { createAdminClient } from "@/lib/supabaseServer";
import { enqueueDfeDistSyncJob } from "@/lib/fiscal/inbound/queue";
import { logger } from "@/lib/logger";
import { z } from "zod";

const CompanySettingSchema = z.object({
  company_id: z.string().uuid(),
  nfe_environment: z.enum(["production", "homologation"]).nullable(),
});

const SyncStateSchema = z.object({
  company_id: z.string().uuid(),
  environment: z.enum(["production", "homologation"]),
  last_sync_at: z.string().nullable(),
  last_error: z.string().nullable(),
});

const TLS_COOLDOWN_MS = 60 * 60 * 1000;

function isTlsErrorMessage(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    /unable to get local issuer certificate/i.test(value) ||
    /SEFAZ_TLS_ERROR/i.test(value)
  );
}

function hasActiveTlsCooldown(
  state: z.infer<typeof SyncStateSchema> | undefined,
  referenceTimeMs: number,
): boolean {
  if (!state || !isTlsErrorMessage(state.last_error)) return false;
  if (!state.last_sync_at) return false;

  const lastSyncMs = Date.parse(state.last_sync_at);
  if (Number.isNaN(lastSyncMs)) return false;
  return referenceTimeMs - lastSyncMs < TLS_COOLDOWN_MS;
}

export async function enqueueDfeSyncJobsForConfiguredCompanies(): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("company_settings")
    .select("company_id,nfe_environment")
    .in("nfe_environment", ["production", "homologation"])
    .limit(5000);

  if (error) {
    throw new Error(`Falha ao consultar empresas para sincronização DF-e: ${error.message}`);
  }

  const rows = z.array(CompanySettingSchema).parse(data ?? []);
  const companyIds = Array.from(new Set(rows.map((row) => row.company_id)));

  let stateRows: z.infer<typeof SyncStateSchema>[] = [];
  if (companyIds.length > 0) {
    const { data: syncStateData, error: syncStateError } = await admin
      .from("fiscal_dfe_sync_state")
      .select("company_id,environment,last_sync_at,last_error")
      .in("company_id", companyIds)
      .in("environment", ["production", "homologation"])
      .limit(companyIds.length * 2);

    if (syncStateError) {
      throw new Error(`Falha ao consultar estado de sincronização DF-e: ${syncStateError.message}`);
    }

    stateRows = z.array(SyncStateSchema).parse(syncStateData ?? []);
  }

  const stateByCompanyEnv = new Map<string, z.infer<typeof SyncStateSchema>>();
  for (const state of stateRows) {
    stateByCompanyEnv.set(`${state.company_id}:${state.environment}`, state);
  }

  let created = 0;
  let reused = 0;
  let skippedCooldown = 0;
  const nowMs = Date.now();

  for (const row of rows) {
    if (!row.nfe_environment) continue;
    const stateKey = `${row.company_id}:${row.nfe_environment}`;
    const state = stateByCompanyEnv.get(stateKey);
    if (hasActiveTlsCooldown(state, nowMs)) {
      skippedCooldown += 1;
      continue;
    }

    const enqueueResult = await enqueueDfeDistSyncJob(admin, {
      companyId: row.company_id,
      environment: row.nfe_environment,
      source: "scheduler",
      requestedBy: null,
    });

    if (enqueueResult.created) created += 1;
    else reused += 1;
  }

  logger.info("[NFE_DFE_DIST_SYNC] Scheduler cycle concluído", {
    scannedCompanies: rows.length,
    created,
    reused,
    skippedCooldown,
  });
}

export class DfeSyncScheduler {
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(intervalMs = 10 * 60 * 1000) {
    this.intervalMs = intervalMs;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const tick = async (): Promise<void> => {
      if (!this.running) return;
      try {
        await enqueueDfeSyncJobsForConfiguredCompanies();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[NFE_DFE_DIST_SYNC] Scheduler tick falhou", { message });
      }
    };

    await tick();
    this.timer = setInterval(() => {
      void tick();
    }, this.intervalMs);

    logger.info("[NFE_DFE_DIST_SYNC] Scheduler iniciado", {
      intervalMs: this.intervalMs,
    });
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    logger.info("[NFE_DFE_DIST_SYNC] Scheduler parado");
  }
}
