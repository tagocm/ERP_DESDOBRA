export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabaseServer";
import { normalizeCancellationReason, validateCancellationReason } from "@/lib/fiscal/nfe/cancellation-rules";
import { resolveEmissionForFiscalAction } from "@/lib/fiscal/nfe/resolve-emission";
import { ensureEmissionProtocol } from "@/lib/fiscal/nfe/ensure-emission-protocol";

type Payload = {
    emissionId?: string;
    accessKey?: string;
    salesDocumentId?: string;
    nfeNumber?: string | number;
    nfeSeries?: string | number;
    reason?: string;
};

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const body = await request.json() as Payload;
        if (!body?.emissionId) {
            return NextResponse.json({ error: "emissionId é obrigatório" }, { status: 400 });
        }

        const reason = normalizeCancellationReason(body.reason || "");
        const validation = validateCancellationReason(reason);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.message }, { status: 400 });
        }

        const admin = createAdminClient();

        // Get the companies the user is a member of to scope the search
        const { data: userCompanies } = await supabase
            .from("company_members")
            .select("company_id")
            .eq("auth_user_id", user.id);

        const companyIds = (userCompanies || []).map(m => m.company_id);

        if (companyIds.length === 0) {
            return NextResponse.json({ error: "Usuário não vinculado a nenhuma empresa." }, { status: 403 });
        }

        // Use the robust utility to find the emission (handles legacy and auto-backfill)
        const emission = await resolveEmissionForFiscalAction({
            admin,
            companyIds,
            payload: {
                emissionId: body.emissionId,
                accessKey: body.accessKey,
                salesDocumentId: body.salesDocumentId,
                nfeNumber: body.nfeNumber,
                nfeSeries: body.nfeSeries,
            }
        });

        // Re-check permission and existence
        if (!emission) {
            return NextResponse.json({ error: "NF-e não encontrada." }, { status: 404 });
        }

        // Double check permission (utility already filters by companyIds, but belt and suspenders)
        if (!companyIds.includes(emission.company_id)) {
            return NextResponse.json({ error: "Sem permissão para esta empresa." }, { status: 403 });
        }

        if (emission.status === "cancelled") {
            return NextResponse.json({ error: "NF-e já está cancelada." }, { status: 400 });
        }

        if (emission.status !== "authorized") {
            return NextResponse.json({ error: "Somente NF-e autorizada pode ser cancelada." }, { status: 400 });
        }

        const nProt = await ensureEmissionProtocol({
            admin,
            emissionId: emission.id,
            companyId: emission.company_id,
            accessKey: emission.access_key,
            existingNProt: emission.n_prot,
        });

        if (!nProt) {
            return NextResponse.json({ error: "NF-e sem protocolo de autorização (nProt). Tente 'Consultar Situação' antes de cancelar." }, { status: 400 });
        }

        const cancellationSequence = 1;

        const { data: cancellation, error: cancellationError } = await admin
            .from("nfe_cancellations")
            .upsert({
                company_id: emission.company_id,
                nfe_emission_id: emission.id,
                sales_document_id: emission.sales_document_id,
                access_key: emission.access_key,
                sequence: cancellationSequence,
                reason,
                status: "pending",
                c_stat: null,
                x_motivo: null,
                protocol: null,
                processed_at: null,
                created_by: user.id,
            }, { onConflict: "company_id,access_key,sequence" })
            .select("id, sequence")
            .single();

        if (cancellationError || !cancellation) {
            return NextResponse.json({ error: cancellationError?.message || "Falha ao criar solicitação de cancelamento." }, { status: 500 });
        }

        const { data: job, error: jobError } = await admin
            .from("jobs_queue")
            .insert({
                job_type: "NFE_CANCEL",
                payload: { cancellationId: cancellation.id, companyId: emission.company_id },
                status: "pending",
            })
            .select("id")
            .single();

        if (jobError || !job) {
            await admin
                .from("nfe_cancellations")
                .update({
                    status: "failed",
                    x_motivo: "Falha ao enfileirar processamento do cancelamento.",
                })
                .eq("id", cancellation.id);

            return NextResponse.json({ error: jobError?.message || "Falha ao enfileirar cancelamento." }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            cancellationId: cancellation.id,
            sequence: cancellation.sequence,
            jobId: job.id,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Erro interno ao solicitar cancelamento da NF-e." },
            { status: 500 }
        );
    }
}
