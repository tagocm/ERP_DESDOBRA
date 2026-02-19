export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveCompanyContext();
        const supabase = ctx.supabase;
        const companyId = ctx.companyId;

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }

        const parsed = z.object({
            emissionId: z.string().uuid(),
        }).safeParse(body);

        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        const emissionId = parsed.data.emissionId;

        const { data: emission, error: emissionError } = await supabase
            .from("nfe_emissions")
            .select("id, company_id, access_key, numero, serie")
            .eq("id", emissionId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (emissionError || !emission) {
            return errorResponse("NF-e não encontrada", 404, "NOT_FOUND");
        }

        const { data: letter, error: letterError } = await supabase
            .from("nfe_correction_letters")
            .select("id, sequence, response_xml, request_xml, created_at, updated_at")
            .eq("company_id", companyId)
            .eq("nfe_emission_id", emissionId)
            .eq("status", "authorized")
            .order("sequence", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (letterError) {
            return errorResponse("Falha ao buscar carta de correção", 500, "INTERNAL_ERROR");
        }

        if (!letter) {
            return errorResponse("Esta NF-e não possui carta de correção autorizada", 404, "CCE_NOT_FOUND");
        }

        const xml = (letter.response_xml || letter.request_xml || "").trim();
        if (!xml) {
            return errorResponse("XML da carta de correção não disponível", 404, "CCE_XML_NOT_FOUND");
        }

        return NextResponse.json({
            success: true,
            data: {
                id: letter.id,
                emissionId,
                accessKey: emission.access_key,
                number: emission.numero,
                series: emission.serie,
                sequence: letter.sequence || 1,
                xml,
                createdAt: letter.created_at || letter.updated_at || null,
            }
        });
    } catch (error: any) {
        return errorResponse("Falha ao buscar artefato da carta de correção", 500, "INTERNAL_ERROR", {
            details: error?.message || "erro desconhecido",
        });
    }
}
