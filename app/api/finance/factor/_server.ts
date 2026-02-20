import { errorResponse } from "@/lib/api/response";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { FactorService, FactorServiceError } from "@/lib/services/factor/factor-service";

export async function resolveFactorService() {
    const context = await resolveCompanyContext();
    const service = new FactorService(context.supabase, context.companyId, context.userId);
    return { context, service };
}

export function handleFactorApiError(error: unknown) {
    if (error instanceof FactorServiceError) {
        return errorResponse(error.message, error.status, error.code);
    }

    if (error instanceof Error) {
        return errorResponse(error.message, 500, "INTERNAL_ERROR");
    }

    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
}

