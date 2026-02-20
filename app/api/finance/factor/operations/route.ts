import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";
import { createFactorOperationSchema } from "@/lib/services/factor/schemas";
import { factorOperationStatusSchema, uuidSchema } from "@/lib/repositories/factor/schemas";

const listOperationsQuerySchema = z.object({
    status: factorOperationStatusSchema.optional(),
    factorId: uuidSchema.optional(),
    search: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const query = listOperationsQuerySchema.safeParse({
            status: request.nextUrl.searchParams.get("status") ?? undefined,
            factorId: request.nextUrl.searchParams.get("factorId") ?? undefined,
            search: request.nextUrl.searchParams.get("search") ?? undefined,
            limit: request.nextUrl.searchParams.get("limit") ?? undefined,
        });

        if (!query.success) {
            return errorResponse("Parâmetros inválidos", 400, "INVALID_QUERY", query.error.flatten());
        }

        const operations = await service.listOperations(query.data);
        return okResponse({ operations });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const body: unknown = await request.json();
        const parsed = createFactorOperationSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD", parsed.error.flatten());
        }

        const operation = await service.createOperation(parsed.data);
        return okResponse({ operation }, 201);
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

