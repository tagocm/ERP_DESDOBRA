import { createAdminClient } from "@/lib/supabaseServer";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { processDfeDistSyncJob } from "@/lib/fiscal/inbound/sync-worker";
import { processDfeManifestSendJob } from "@/lib/fiscal/inbound/manifest-worker";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

const JobSchema = z.object({
  id: z.string().uuid(),
  job_type: z.string().min(1),
  payload: z.unknown(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  last_error: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  scheduled_for: z.string(),
});

export type Job = z.infer<typeof JobSchema>;

export interface WorkerOptions {
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  backoffMultiplier?: number;
  jobType: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Error";
}

export class JobWorker {
  private isRunning = false;
  private readonly minPollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly backoffMultiplier: number;
  private currentPollIntervalMs: number;
  private readonly jobType: string;

  constructor(options: WorkerOptions) {
    this.minPollIntervalMs = options.pollIntervalMs || 5000;
    this.maxPollIntervalMs = options.maxPollIntervalMs || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.currentPollIntervalMs = this.minPollIntervalMs;
    this.jobType = options.jobType;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`[Worker:${this.jobType}] Started polling`);
    void this.loop();
  }

  stop(): void {
    this.isRunning = false;
    logger.info(`[Worker:${this.jobType}] Stop signal received`);
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = await this.fetchNextJob();

        if (job) {
          logger.info(`[Worker:${this.jobType}] Processing job`, {
            jobId: job.id,
            attempt: job.attempts,
            maxAttempts: job.max_attempts,
          });
          this.currentPollIntervalMs = this.minPollIntervalMs;
          await this.processJob(job);
        } else {
          await this.sleepWithJitter(this.currentPollIntervalMs);
          this.currentPollIntervalMs = Math.min(
            this.maxPollIntervalMs,
            Math.floor(this.currentPollIntervalMs * this.backoffMultiplier),
          );
        }
      } catch (error) {
        logger.error(`[Worker:${this.jobType}] Critical loop error`, { message: errorMessage(error) });
        await this.sleepWithJitter(this.currentPollIntervalMs);
        this.currentPollIntervalMs = Math.min(
          this.maxPollIntervalMs,
          Math.floor(this.currentPollIntervalMs * this.backoffMultiplier),
        );
      }
    }

    logger.info(`[Worker:${this.jobType}] Loop stopped`);
  }

  private async sleepWithJitter(baseMs: number): Promise<void> {
    const jitter = Math.floor(Math.random() * Math.floor(baseMs * 0.25));
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }

  private async fetchNextJob(): Promise<Job | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("fetch_next_job", {
      p_job_type: this.jobType,
    });

    if (error) {
      logger.error(`[Worker:${this.jobType}] Fetch error`, { message: error.message });
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return JobSchema.parse(data[0]);
    }

    return null;
  }

  private async processJob(job: Job): Promise<void> {
    const supabase = createAdminClient();

    try {
      await this.handleJobLogic(job);

      await supabase
        .from("jobs_queue")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      logger.info(`[Worker:${this.jobType}] Job completed`, { jobId: job.id });
    } catch (error) {
      const message = errorMessage(error);
      logger.error(`[Worker:${this.jobType}] Job failed`, { jobId: job.id, message });

      const nextStatus: JobStatus = job.attempts >= job.max_attempts ? "failed" : "pending";
      const nextSchedule = new Date();

      if (nextStatus === "pending") {
        const backoffMinutes = Math.pow(2, job.attempts);
        nextSchedule.setMinutes(nextSchedule.getMinutes() + backoffMinutes);
      }

      await supabase
        .from("jobs_queue")
        .update({
          status: nextStatus,
          last_error: message,
          scheduled_for: nextStatus === "pending" ? nextSchedule.toISOString() : job.scheduled_for,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      throw error;
    }
  }

  private async handleJobLogic(job: Job): Promise<void> {
    switch (this.jobType) {
      case "NFE_EMIT": {
        const payload = z
          .object({
            orderId: z.string().uuid(),
            companyId: z.string().uuid(),
          })
          .parse(job.payload);

        const { emitOffline } = await import("@/lib/fiscal/nfe/offline/emitOffline");
        const result = await emitOffline(payload.orderId, payload.companyId, true);

        if (!result.success) {
          throw new Error(result.message || "Falha desconhecida na emissão via emitOffline");
        }
        return;
      }

      case "NFE_CCE": {
        const { processCorrectionLetterJob } = await import("@/lib/fiscal/nfe/correction-letter-worker");
        await processCorrectionLetterJob(job.payload as { correctionLetterId?: string; companyId?: string });
        return;
      }

      case "NFE_CANCEL": {
        const { processNfeCancellationJob } = await import("@/lib/fiscal/nfe/cancellation-worker");
        await processNfeCancellationJob(job.payload as { cancellationId?: string; companyId?: string });
        return;
      }

      case "NFE_INBOUND_REVERSAL_EMIT": {
        const payload = z
          .object({
            companyId: z.string().uuid(),
            reversalId: z.string().uuid(),
          })
          .parse(job.payload);

        const { emitInboundReversalFromOutbound } = await import("@/lib/fiscal/nfe/reversal/emitInboundReversal");
        await emitInboundReversalFromOutbound({
          companyId: payload.companyId,
          reversalId: payload.reversalId,
        });
        return;
      }

      case "NFE_DFE_DIST_SYNC": {
        await processDfeDistSyncJob(job.payload, job.id);
        return;
      }

      case "NFE_DFE_MANIFEST_SEND": {
        await processDfeManifestSendJob(job.payload, job.id);
        return;
      }

      default:
        logger.warn("[Worker] No handler for job type", { jobType: this.jobType, jobId: job.id });
    }
  }
}
