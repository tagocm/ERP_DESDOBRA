export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import { errorResponse } from "@/lib/api/response";
import { generateNfeEventPdf } from "@/lib/fiscal/nfe/event-pdf";
import { resolveCompanyLogoDataUri, resolveCompanyLogoUrl } from "@/lib/fiscal/nfe/logo-resolver";
import { createAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
    type: z.enum(["cancellation", "correction_letter"]),
    id: z.string().uuid(),
});

function toNumberOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

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

        const table = type === "correction_letter" ? "nfe_correction_letters" : "nfe_cancellations";
        const selectColumns =
            type === "correction_letter"
                ? "id,nfe_emission_id,sales_document_id,access_key,sequence,status,c_stat,x_motivo,protocol,correction_text,request_xml,response_xml,created_at,updated_at,processed_at"
                : "id,nfe_emission_id,sales_document_id,access_key,sequence,status,c_stat,x_motivo,protocol,reason,request_xml,response_xml,created_at,updated_at,processed_at";

        const { data: event, error: eventError } = await supabase
            .from(table)
            .select(selectColumns)
            .eq("company_id", companyId)
            .eq("id", id)
            .maybeSingle();

        if (eventError || !event) {
            return errorResponse("Evento não encontrado", 404, "NOT_FOUND");
        }

        const emissionId = event.nfe_emission_id || null;
        const eventAccessKey = event.access_key || null;
        const salesDocumentIdFromEvent = event.sales_document_id || null;

        let emission: any = null;
        if (emissionId) {
            const { data } = await supabase
                .from("nfe_emissions")
                .select("id,sales_document_id,access_key,numero,serie,status,n_prot,tp_amb")
                .eq("id", emissionId)
                .eq("company_id", companyId)
                .maybeSingle();
            emission = data || null;
        }

        if (!emission && eventAccessKey) {
            const { data } = await supabase
                .from("nfe_emissions")
                .select("id,sales_document_id,access_key,numero,serie,status,n_prot,tp_amb")
                .eq("company_id", companyId)
                .eq("access_key", eventAccessKey)
                .maybeSingle();
            emission = data || null;
        }

        const salesDocumentId = salesDocumentIdFromEvent || emission?.sales_document_id || null;

        let salesDocument: any = null;
        if (salesDocumentId) {
            const { data } = await supabase
                .from("sales_documents")
                .select(`
                    id,
                    document_number,
                    total_amount,
                    client:organizations!client_id(legal_name,trade_name,document_number,state_registration)
                `)
                .eq("id", salesDocumentId)
                .eq("company_id", companyId)
                .maybeSingle();
            salesDocument = data || null;
        }

        const [{ data: company }, { data: companySettings }] = await Promise.all([
            supabase
                .from("companies")
                .select("id,name,document_number,addresses(*)")
                .eq("id", companyId)
                .maybeSingle(),
            supabase
                .from("company_settings")
                .select("legal_name,trade_name,cnpj,ie,phone,email")
                .eq("company_id", companyId)
                .maybeSingle(),
        ]);

        const emitterAddress =
            (company?.addresses || []).find((addr: any) => addr?.is_main) ||
            (company?.addresses || [])[0] ||
            null;

        const client = Array.isArray(salesDocument?.client)
            ? salesDocument?.client?.[0] || null
            : salesDocument?.client || null;

        const occurredAt = event.processed_at || event.updated_at || event.created_at || new Date().toISOString();
        const accessKey = emission?.access_key || eventAccessKey || null;
        const eventAny = event as any;

        const adminSupabase = createAdminClient();
        const logoUrl =
            await resolveCompanyLogoDataUri(adminSupabase, companyId) ||
            await resolveCompanyLogoUrl(adminSupabase, companyId);

        const pdfBuffer = await generateNfeEventPdf({
            type,
            sequence: toNumberOrNull(event.sequence),
            status: event.status || null,
            cStat: event.c_stat || null,
            xMotivo: event.x_motivo || null,
            protocol: event.protocol || null,
            occurredAt,
            accessKey,
            nfeNumber: toNumberOrNull(emission?.numero),
            nfeSeries: toNumberOrNull(emission?.serie),
            nfeProtocol: emission?.n_prot || null,
            nfeStatus: emission?.status || null,
            reason: type === "cancellation" ? (eventAny.reason || null) : null,
            correctionText: type === "correction_letter" ? (eventAny.correction_text || null) : null,
            requestXml: event.request_xml || null,
            responseXml: event.response_xml || null,
            emitter: {
                legalName: companySettings?.legal_name || company?.name || null,
                tradeName: companySettings?.trade_name || company?.name || null,
                cnpj: companySettings?.cnpj || company?.document_number || null,
                ie: companySettings?.ie || null,
                phone: companySettings?.phone || null,
                email: companySettings?.email || null,
                addressStreet: emitterAddress?.street || null,
                addressNumber: emitterAddress?.number || null,
                addressComplement: emitterAddress?.complement || null,
                addressNeighborhood: emitterAddress?.neighborhood || null,
                addressCity: emitterAddress?.city || null,
                addressState: emitterAddress?.state || null,
                addressZip: emitterAddress?.zip || null,
            },
            recipient: client
                ? {
                    name: client.trade_name || client.legal_name || null,
                    documentNumber: client.document_number || null,
                    ie: client.state_registration || null,
                }
                : null,
            document: {
                number: toNumberOrNull(salesDocument?.document_number),
                totalAmount: toNumberOrNull(salesDocument?.total_amount),
            },
            environment: emission?.tp_amb ? String(emission.tp_amb) : null,
            generatedAt: new Date().toISOString(),
            logoUrl: logoUrl || null,
        });

        const filePrefix = type === "correction_letter" ? "cce" : "canc";
        const fileName = `${filePrefix}-${accessKey || "sem-chave"}-seq-${String(event.sequence || 1).padStart(2, "0")}.pdf`;

        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        return errorResponse("Falha ao gerar PDF do evento", 500, "INTERNAL_ERROR", {
            details: error?.message || "erro desconhecido",
        });
    }
}
