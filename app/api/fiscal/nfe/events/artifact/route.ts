export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { errorResponse } from "@/lib/api/response";

const payloadSchema = z.object({
    type: z.enum(["cancellation", "correction_letter"]),
    id: z.string().uuid(),
});

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

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        const { type, id } = parsed.data;

        if (type === "correction_letter") {
            const { data, error } = await supabase
                .from("nfe_correction_letters")
                .select("id, sequence, status, request_xml, response_xml, created_at, updated_at")
                .eq("company_id", companyId)
                .eq("id", id)
                .maybeSingle();

            if (error || !data) {
                return errorResponse("Evento não encontrado", 404, "NOT_FOUND");
            }

            const xml = String(data.response_xml || data.request_xml || "").trim();
            if (!xml) {
                return errorResponse("XML do evento não disponível", 404, "XML_NOT_FOUND");
            }

            return NextResponse.json({
                success: true,
                data: {
                    id: data.id,
                    type,
                    sequence: data.sequence || 1,
                    status: data.status,
                    xml,
                    createdAt: data.created_at || data.updated_at || null,
                },
            });
        }

        const { data, error } = await supabase
            .from("nfe_cancellations")
            .select("id, sequence, status, request_xml, response_xml, created_at, updated_at")
            .eq("company_id", companyId)
            .eq("id", id)
            .maybeSingle();

        if (error || !data) {
            return errorResponse("Evento não encontrado", 404, "NOT_FOUND");
        }

        const xml = String(data.response_xml || data.request_xml || "").trim();
        if (!xml) {
            return errorResponse("XML do evento não disponível", 404, "XML_NOT_FOUND");
        }

        return NextResponse.json({
            success: true,
            data: {
                id: data.id,
                type,
                sequence: data.sequence || 1,
                status: data.status,
                xml,
                createdAt: data.created_at || data.updated_at || null,
            },
        });
    } catch (error: any) {
        return errorResponse("Falha ao buscar XML do evento", 500, "INTERNAL_ERROR", {
            details: error?.message || "erro desconhecido",
        });
    }
}

