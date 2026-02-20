import { NextRequest } from "next/server";
import { okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";

export async function GET(request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const query = request.nextUrl.searchParams.get("q") ?? undefined;
        const installments = await service.listEligibleInstallments(query);
        return okResponse({ installments });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

