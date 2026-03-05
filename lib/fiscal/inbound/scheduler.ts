import { createAdminClient } from "@/lib/supabaseServer";
import { enqueueDfeDistSyncJob } from "@/lib/fiscal/inbound/queue";
import { logger } from "@/lib/logger";
import { z } from "zod";

const CompanySettingSchema = z.object({
  company_id: z.string().uuid(),
  nfe_environment: z.enum(["production", "homologation"]).nullable(),
});

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
  let created = 0;
  let reused = 0;

  for (const row of rows) {
    if (!row.nfe_environment) continue;

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
