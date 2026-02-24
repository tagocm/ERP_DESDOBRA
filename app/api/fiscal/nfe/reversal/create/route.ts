export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabaseServer";
import { resolveEmissionForFiscalAction } from "@/lib/fiscal/nfe/resolve-emission";
import {
    CreateInboundReversalRequestSchema,
    CreateInboundReversalResponseSchema,
} from "@/lib/fiscal/nfe/reversal/schemas";
import { z } from "zod";

const RpcResultSchema = z.object({
    reversal_id: z.string().uuid(),
    job_id: z.string().uuid().nullable(),
    existing: z.boolean(),
});

const ReversalRowSchema = z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    status: z.string(),
    inbound_emission_id: z.string().uuid().nullable().optional(),
}).passthrough();

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        const bodyUnknown: unknown = await req.json().catch(() => null);
        const body = CreateInboundReversalRequestSchema.parse(bodyUnknown);

        const { data: memberships, error: membershipError } = await supabase
            .from("company_members")
            .select("company_id")
            .eq("auth_user_id", user.id);

        if (membershipError) {
            return NextResponse.json({ error: "Falha ao validar vínculo com empresa." }, { status: 500 });
        }

        const companyIds = (memberships || []).map((m) => m.company_id).filter((id): id is string => typeof id === "string" && id.length > 0);
        if (companyIds.length === 0) return NextResponse.json({ error: "Usuário não vinculado a nenhuma empresa." }, { status: 403 });

        const admin = createAdminClient();

        const emission = await resolveEmissionForFiscalAction({
            admin,
            companyIds,
            payload: { emissionId: body.outboundEmissionId },
        });
        if (!emission) return NextResponse.json({ error: "NF-e não encontrada." }, { status: 404 });

        // Hard gate: only authorized
        if (String(emission.status || "") !== "authorized") {
            return NextResponse.json({ error: "Somente NF-e autorizada pode gerar estorno." }, { status: 400 });
        }

        const payload = {
            mode: body.mode,
            reason_code: body.reasonCode,
            reason_other: body.reasonOther ?? null,
            internal_notes: body.internalNotes ?? null,
            selection: body.mode === "PARCIAL" ? (body.selection || []) : [],
        };

        const { data: rpcData, error: rpcError } = await admin.rpc("create_inbound_reversal_request", {
            p_company_id: emission.company_id,
            p_outbound_emission_id: emission.id,
            p_payload: payload,
            p_created_by: user.id,
        });

        if (rpcError) {
            return NextResponse.json({ error: rpcError.message }, { status: 400 });
        }

        const rpcRowUnknown = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const rpcRow = RpcResultSchema.parse(rpcRowUnknown);

        const { data: reversalRow, error: reversalError } = await admin
            .from("nfe_inbound_reversals")
            .select("id,company_id,status,inbound_emission_id")
            .eq("id", rpcRow.reversal_id)
            .eq("company_id", emission.company_id)
            .maybeSingle();

        if (reversalError) {
            return NextResponse.json({ error: `Falha ao carregar estorno criado: ${reversalError.message}` }, { status: 500 });
        }

        const reversal = reversalRow ? ReversalRowSchema.parse(reversalRow) : null;

        const response = CreateInboundReversalResponseSchema.parse({
            success: true,
            reversalId: rpcRow.reversal_id,
            existing: rpcRow.existing,
            jobId: rpcRow.job_id,
            inboundEmissionId: reversal?.inbound_emission_id ?? null,
            status: reversal?.status ?? "pending",
        });

        return NextResponse.json(response);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erro interno ao solicitar estorno.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

