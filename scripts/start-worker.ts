import { JobWorker } from "../lib/queue/worker";
import { DfeSyncScheduler } from "@/lib/fiscal/inbound/scheduler";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: ".env.local" });

async function main() {
  console.log("--- NFe Worker Starting ---");
  console.log("Environment:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Loaded" : "Missing");

  const workers = [
    new JobWorker({
      jobType: "NFE_EMIT",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
    new JobWorker({
      jobType: "NFE_CCE",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
    new JobWorker({
      jobType: "NFE_CANCEL",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
    new JobWorker({
      jobType: "NFE_INBOUND_REVERSAL_EMIT",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
    new JobWorker({
      jobType: "NFE_DFE_DIST_SYNC",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
    new JobWorker({
      jobType: "NFE_DFE_MANIFEST_SEND",
      pollIntervalMs: 2000,
      maxPollIntervalMs: 30000,
      backoffMultiplier: 2,
    }),
  ];

  const scheduler = new DfeSyncScheduler(10 * 60 * 1000);

  console.log("Worker polling strategy: min=2s, max=30s, backoff=2x, jitter=0-25%");

  process.on("SIGINT", () => {
    console.log("SIGINT received. Stopping worker...");
    scheduler.stop();
    workers.forEach((worker) => worker.stop());
    setTimeout(() => process.exit(0), 1000);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Stopping worker...");
    scheduler.stop();
    workers.forEach((worker) => worker.stop());
    setTimeout(() => process.exit(0), 1000);
  });

  await Promise.all(workers.map((worker) => worker.start()));
  await scheduler.start();
}

main().catch((error) => {
  console.error("Fatal Worker Error:", error);
  process.exit(1);
});
