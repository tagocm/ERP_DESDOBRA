import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

export async function POST(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { service } = await resolveFactorService();
        const params = paramsSchema.safeParse(await context.params);
        if (!params.success) {
            return errorResponse("Operação inválida", 400, "INVALID_OPERATION_ID", params.error.flatten());
        }

        const result = await service.sendToFactor(params.data.id);
        return okResponse(result);
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

