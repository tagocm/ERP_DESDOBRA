import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";

const paramsSchema = z.object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
});

export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ id: string; itemId: string }> },
) {
    try {
        const { service } = await resolveFactorService();
        const params = paramsSchema.safeParse(await context.params);
        if (!params.success) {
            return errorResponse("Parâmetros inválidos", 400, "INVALID_PARAMS", params.error.flatten());
        }

        await service.removeOperationItem(params.data.id, params.data.itemId);
        return okResponse({ success: true });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

