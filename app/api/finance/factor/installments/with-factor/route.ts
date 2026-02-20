import { NextRequest } from "next/server";
import { okResponse } from "@/lib/api/response";
import { handleFactorApiError, resolveFactorService } from "@/app/api/finance/factor/_server";

export async function GET(_request: NextRequest) {
    try {
        const { service } = await resolveFactorService();
        const installments = await service.listInstallmentsWithFactor();
        return okResponse({ installments });
    } catch (error: unknown) {
        return handleFactorApiError(error);
    }
}

