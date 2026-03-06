import { createAdminClient } from "@/lib/supabaseServer";
import { createDfeProvider } from "@/lib/fiscal/inbound/provider";
import { mapNormalizedDocToRpcRow } from "@/lib/fiscal/inbound/normalize";
import { logger } from "@/lib/logger";
import { DfeSyncJobPayloadSchema } from "@/lib/fiscal/inbound/schemas";
import { z } from "zod";

const SyncStateSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  environment: z.string().optional(),
  last_nsu: z.string().default("0"),
  status: z.string().optional(),
});

const UpsertBatchResultSchema = z.object({
  inserted_count: z.number().int().nonnegative(),
  updated_count: z.number().int().nonnegative(),
});

function parseSingleRpcRow<T>(payload: unknown, schema: z.ZodType<T>): T {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error("RPC retornou array vazio");
    }
    return schema.parse(payload[0]);
  }
  return schema.parse(payload);
}

function maxNsu(current: string, next: string): string {
  try {
    const currentBig = BigInt(current);
    const nextBig = BigInt(next);
    return nextBig > currentBig ? next : current;
  } catch {
    return next > current ? next : current;
  }
}

export async function processDfeDistSyncJob(payload: unknown, jobId: string): Promise<void> {
  const parsedPayload = DfeSyncJobPayloadSchema.parse(payload);
  const admin = createAdminClient();
  const provider = createDfeProvider();

  logger.info("[NFE_DFE_DIST_SYNC] Iniciando sincronização", {
    jobId,
    companyId: parsedPayload.companyId,
    environment: parsedPayload.environment,
    source: parsedPayload.source,
  });

  let lastNsu = "0";

  try {
    const { data: runningData, error: runningError } = await admin.rpc("set_dfe_sync_running", {
      p_company_id: parsedPayload.companyId,
      p_environment: parsedPayload.environment,
    });

    if (runningError) {
      throw new Error(`Falha ao marcar sincronização em execução: ${runningError.message}`);
    }

    const runningState = parseSingleRpcRow(runningData, SyncStateSchema);
    lastNsu = runningState.last_nsu || "0";

    let hasMore = true;
    let pages = 0;
    const maxPages = 50;

    while (hasMore && pages < maxPages) {
      pages += 1;
      const fetchResult = await provider.fetchByNsu({
        companyId: parsedPayload.companyId,
        environment: parsedPayload.environment,
        lastNsu,
        jobId,
      });

      const rows = fetchResult.docs.map(mapNormalizedDocToRpcRow);
      if (rows.length > 0) {
        const { data: batchData, error: batchError } = await admin.rpc("upsert_inbound_dfe_batch", {
          p_company_id: parsedPayload.companyId,
          p_environment: parsedPayload.environment,
          p_rows: rows,
        });

        if (batchError) {
          throw new Error(`Falha no upsert do lote DF-e: ${batchError.message}`);
        }

        const batchResult = parseSingleRpcRow(batchData, UpsertBatchResultSchema);
        logger.info("[NFE_DFE_DIST_SYNC] Lote processado", {
          jobId,
          page: pages,
          fetched: rows.length,
          inserted: batchResult.inserted_count,
          updated: batchResult.updated_count,
          nextNsu: fetchResult.maxNsu,
        });
      }

      lastNsu = maxNsu(lastNsu, fetchResult.maxNsu);
      hasMore = fetchResult.hasMore;
      if (rows.length === 0 && fetchResult.maxNsu === lastNsu) {
        hasMore = false;
      }
    }

    if (pages >= maxPages) {
      logger.warn("[NFE_DFE_DIST_SYNC] Encerrado por limite de páginas", {
        jobId,
        companyId: parsedPayload.companyId,
        environment: parsedPayload.environment,
        lastNsu,
      });
    }

    const { error: finishError } = await admin.rpc("set_dfe_sync_result", {
      p_company_id: parsedPayload.companyId,
      p_environment: parsedPayload.environment,
      p_last_nsu: lastNsu,
      p_status: "IDLE",
      p_last_error: null,
    });

    if (finishError) {
      throw new Error(`Falha ao finalizar estado de sincronização: ${finishError.message}`);
    }

    logger.info("[NFE_DFE_DIST_SYNC] Sincronização concluída", {
      jobId,
      companyId: parsedPayload.companyId,
      environment: parsedPayload.environment,
      lastNsu,
      pages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const { error: resultError } = await admin.rpc("set_dfe_sync_result", {
      p_company_id: parsedPayload.companyId,
      p_environment: parsedPayload.environment,
      p_last_nsu: lastNsu,
      p_status: "ERROR",
      p_last_error: message,
    });

    if (resultError) {
      logger.warn("[NFE_DFE_DIST_SYNC] Falha ao registrar erro no estado", {
        jobId,
        message: resultError.message,
      });
    }

    logger.error("[NFE_DFE_DIST_SYNC] Erro na sincronização", {
      jobId,
      companyId: parsedPayload.companyId,
      environment: parsedPayload.environment,
      error: message,
    });

    throw error;
  }
}
