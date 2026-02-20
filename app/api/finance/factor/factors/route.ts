import { NextRequest } from "next/server";
import { errorResponse, okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";
import { createFactorSchema } from "@/lib/services/factor/schemas";

export async function GET(_request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const factors = await service.listFactors();
        return okResponse({ factors });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const payload: unknown = await request.json();
        const parsed = createFactorSchema.safeParse(payload);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD", parsed.error.flatten());
        }

        const factor = await service.createFactor(parsed.data);
        return okResponse({ factor }, 201);
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}
