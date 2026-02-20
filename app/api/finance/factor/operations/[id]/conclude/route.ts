import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";
import { concludeFactorOperationSchema } from "@/lib/services/factor/schemas";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { service } = await resolveFactorService();
        const params = paramsSchema.safeParse(await context.params);
        if (!params.success) {
            return errorResponse("Operação inválida", 400, "INVALID_OPERATION_ID", params.error.flatten());
        }

        const payload: unknown = await request.json().catch(() => ({}));
        const parsed = concludeFactorOperationSchema.safeParse(payload);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD", parsed.error.flatten());
        }

        const result = await service.concludeOperation(params.data.id, parsed.data);
        return okResponse(result);
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

