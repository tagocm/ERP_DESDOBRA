import { JobWorker } from "../lib/queue/worker";
import { DfeSyncScheduler } from "@/lib/fiscal/inbound/scheduler";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Load env vars
dotenv.config({ path: ".env.local" });

function enforceDfeSingleShotDiagnosticFlag(): void {
  const raw = process.env.NFE_DFE_DIST_SINGLE_SHOT;
  if (raw === undefined || raw.trim() === "") {
    process.env.NFE_DFE_DIST_SINGLE_SHOT = "true";
    console.log("[NFE_DFE_DIST_SYNC] NFE_DFE_DIST_SINGLE_SHOT não definido; ativando diagnóstico single-shot por padrão.");
    return;
  }

  console.log(`[NFE_DFE_DIST_SYNC] NFE_DFE_DIST_SINGLE_SHOT=${raw}`);
}

function validateSefazCaBundleOnStartup(): void {
  const rawPath = process.env.SEFAZ_CA_BUNDLE_PATH;
  if (!rawPath) {
    console.log("[SEFAZ] SEFAZ_CA_BUNDLE_PATH não configurado (usando store padrão do sistema).");
    return;
  }

  const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[SEFAZ] SEFAZ_CA_BUNDLE_PATH não encontrado: ${resolvedPath}`);
  }

  fs.accessSync(resolvedPath, fs.constants.R_OK);
  const content = fs.readFileSync(resolvedPath);
  const certificateCount = (content.toString("utf8").match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
  if (certificateCount < 1) {
    throw new Error(`[SEFAZ] Bundle inválido em ${resolvedPath}: nenhum bloco BEGIN CERTIFICATE encontrado.`);
  }

  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  console.log("[SEFAZ] CA bundle validado no startup.", {
    resolvedPath,
    sizeBytes: content.length,
    certificateCount,
    sha256,
  });
}

async function main() {
  console.log("--- NFe Worker Starting ---");
  console.log("Environment:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Loaded" : "Missing");
  enforceDfeSingleShotDiagnosticFlag();
  validateSefazCaBundleOnStartup();

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
