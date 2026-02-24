import { createAdminClient } from "@/lib/supabaseServer";
import { buildNfeXml } from "@/lib/nfe/xml/buildNfeXml";
import { uploadNfeArtifact } from "@/lib/fiscal/nfe/offline/storage";
import { emitirNfeHomolog } from "@/lib/nfe/sefaz/services/emitir";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { buildNfeProc, upsertNfeEmission } from "@/lib/nfe/sefaz/services/persistence";
import { buildDraftFromDb } from "@/lib/fiscal/nfe/offline/mappers";
import { buildInboundReversalNfe } from "./buildInboundReversalNfe";
import { ReversalReasonCodeSchema, ReversalSelectionItemSchema } from "./schemas";
import { z } from "zod";

function generateRandomCNF(): string {
    return Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
}

function pad(val: string | number, len: number): string {
    return String(val).padStart(len, "0");
}

function getIbgeUf(uf: string): string {
    const map: Record<string, string> = {
        RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
        MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
        SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
        SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
    };
    return map[String(uf || "").toUpperCase()] || "35";
}

function calculateCDV(key: string): string {
    let soma = 0;
    let peso = 2;
    for (let i = key.length - 1; i >= 0; i--) {
        soma += Number(key[i]) * peso;
        peso++;
        if (peso > 9) peso = 2;
    }
    const resto = soma % 11;
    const dv = 11 - resto;
    return (dv >= 10 ? 0 : dv).toString();
}

function toTpAmbFromEnvironment(value?: string | null) {
    return value === "production" ? "1" : "2";
}

const CompanySettingsSchema = z.object({
    cert_a1_storage_path: z.string().nullable().optional(),
    nfe_series: z.union([z.string(), z.number()]).nullable().optional(),
    nfe_next_number: z.union([z.number(), z.string()]).nullable().optional(),
    nfe_environment: z.string().nullable().optional(),
    cnpj: z.string().nullable().optional(),
    address_street: z.string().nullable().optional(),
    address_number: z.string().nullable().optional(),
    address_neighborhood: z.string().nullable().optional(),
    address_city: z.string().nullable().optional(),
    address_state: z.string().nullable().optional(),
    address_zip: z.string().nullable().optional(),
    city_code_ibge: z.string().nullable().optional(),
}).passthrough();

const CompanyAddressSchema = z.object({
    street: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    zip: z.string().nullable().optional(),
    city_code_ibge: z.string().nullable().optional(),
    is_main: z.boolean().nullable().optional(),
}).passthrough();

const CompanyRowSchema = z.object({
    document_number: z.string().nullable().optional(),
    addresses: z.array(CompanyAddressSchema).nullable().optional(),
}).passthrough();

const ReversalRowSchema = z.object({
    id: z.string().uuid(),
    outbound_emission_id: z.string().uuid(),
    inbound_emission_id: z.string().uuid().nullable().optional(),
    mode: z.enum(["TOTAL", "PARCIAL"]),
    status: z.enum(["pending", "processing", "authorized", "failed"]),
    reason_code: z.string(),
    reason_other: z.string().nullable().optional(),
    selection: z.unknown().optional(),
}).passthrough();

const OutboundEmissionSchema = z.object({
    id: z.string().uuid(),
    status: z.string(),
    access_key: z.string().nullable().optional(),
    sales_document_id: z.string().uuid().nullable().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export async function emitInboundReversalFromOutbound(args: { companyId: string; reversalId: string }) {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: reversal, error: reversalError } = await admin
        .from("nfe_inbound_reversals")
        .select("*")
        .eq("id", args.reversalId)
        .eq("company_id", args.companyId)
        .maybeSingle();

    if (reversalError) throw new Error(`Falha ao carregar estorno: ${reversalError.message}`);
    if (!reversal) throw new Error("Solicitação de estorno não encontrada.");

    const reversalRow = ReversalRowSchema.parse(reversal);
    if (reversalRow.status === "authorized" && reversalRow.inbound_emission_id) {
        return { success: true, inboundEmissionId: reversalRow.inbound_emission_id };
    }

    const { data: outbound, error: outboundError } = await admin
        .from("nfe_emissions")
        .select("id, company_id, sales_document_id, access_key, status")
        .eq("id", reversalRow.outbound_emission_id)
        .eq("company_id", args.companyId)
        .maybeSingle();

    if (outboundError) throw new Error(`Falha ao carregar NF-e de saída: ${outboundError.message}`);
    if (!outbound) throw new Error("NF-e de saída não encontrada.");
    const outboundRow = OutboundEmissionSchema.parse(outbound);
    if (outboundRow.status !== "authorized") throw new Error("NF-e de saída precisa estar AUTORIZADA.");
    if (!outboundRow.access_key || String(outboundRow.access_key).length !== 44) throw new Error("Chave de acesso inválida na NF-e de saída.");
    if (!outboundRow.sales_document_id) throw new Error("NF-e de saída sem pedido vinculado. Não é possível gerar estorno automaticamente.");

    // Mark processing (best-effort)
    await admin
        .from("nfe_inbound_reversals")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", reversalRow.id)
        .eq("company_id", args.companyId);

    const { data: order, error: orderError } = await admin
        .from("sales_documents")
        .select(`
            *,
            client:organizations!client_id(*, addresses(*)),
            items:sales_document_items!sales_document_items_document_id_fkey(
                *,
                product:items!sales_document_items_item_id_fkey(*, fiscal:item_fiscal_profiles(*)),
                packaging:item_packaging(*),
                fiscal_operation:fiscal_operations(*)
            ),
            payments:sales_document_payments(*),
            carrier:organizations!carrier_id(*, addresses(*))
        `)
        .eq("id", outboundRow.sales_document_id)
        .single();

    if (orderError || !order) throw new Error("Pedido não encontrado para gerar NF-e de entrada.");

    const orderNormalized = (() => {
        if (!isRecord(order) || !Array.isArray(order.items)) return order;
        const items = order.items.filter(isRecord);
        items.sort((a, b) => {
            const ad = String(a.created_at ?? "");
            const bd = String(b.created_at ?? "");
            if (ad !== bd) return ad.localeCompare(bd);
            return String(a.id ?? "").localeCompare(String(b.id ?? ""));
        });
        return { ...order, items };
    })();

    const [companyResult, settingsResult] = await Promise.all([
        admin.from("companies").select(`*, addresses(*)`).eq("id", args.companyId).single(),
        admin.from("company_settings").select("*").eq("company_id", args.companyId).single(),
    ]);

    if (companyResult.error || !companyResult.data) {
        throw new Error("Empresa não encontrada.");
    }

    const companyRow = CompanyRowSchema.parse(companyResult.data);
    const settings = CompanySettingsSchema.parse(settingsResult.data ?? {});

    if (!settings.cert_a1_storage_path) {
        throw new Error("Certificado A1 não configurado.");
    }

    const serie = String(settings.nfe_series ?? "1");
    const nNF = Number(settings.nfe_next_number ?? 0);
    if (!nNF || nNF <= 0) {
        throw new Error("Próximo número de NF-e não configurado nas configurações da empresa.");
    }

    // Use fiscal address preference when present
    const addresses = Array.isArray(companyRow.addresses) ? companyRow.addresses : [];
    const selectedAddress = (settings.address_street && settings.address_city && settings.address_state && settings.address_zip)
        ? {
            street: settings.address_street,
            number: settings.address_number || "SN",
            neighborhood: settings.address_neighborhood || "GERAL",
            city: settings.address_city,
            state: settings.address_state,
            zip: settings.address_zip,
            city_code_ibge: settings.city_code_ibge || undefined,
            is_main: true,
        }
        : (addresses.find((a) => a.is_main) || addresses[0]);

    const ufState = String(selectedAddress?.state || "SP").toUpperCase();
    const cUF = getIbgeUf(ufState);
    const AAMM = new Date().toISOString().slice(2, 4) + new Date().toISOString().slice(5, 7);
    const rawCnpj = settings.cnpj || companyRow.document_number;
    const cnpj = String(rawCnpj || "").replace(/\D/g, "");
    const mod = "55";
    const tpEmis = "1";
    const tpAmb = toTpAmbFromEnvironment(settings?.nfe_environment);
    const cNF = generateRandomCNF();

    const preKey = `${cUF}${AAMM}${cnpj}${mod}${pad(serie, 3)}${pad(nNF, 9)}${tpEmis}${cNF}`;
    const cDV = calculateCDV(preKey);
    const chNFe = `${preKey}${cDV}`;

    const baseCompany = isRecord(companyResult.data) ? companyResult.data : {};
    const companyForMapper = {
        ...baseCompany,
        addresses: selectedAddress ? [selectedAddress] : [],
        settings,
    };

    const outboundDraft = buildDraftFromDb({
        order: orderNormalized,
        company: companyForMapper,
        keyParams: {
            cNF,
            cUF,
            serie,
            nNF: String(nNF),
            tpAmb,
        },
    });

    outboundDraft.ide.cDV = cDV;
    outboundDraft.ide.chNFe = chNFe;
    outboundDraft.ide.cNF = cNF;

    const selectionParsed = Array.isArray(reversal.selection) ? reversal.selection : [];
    const selectionByNItem = new Map<number, { qty: number; isProduced: boolean }>();
    for (const raw of selectionParsed) {
        const parsed = ReversalSelectionItemSchema.safeParse(raw);
        if (!parsed.success) continue;
        selectionByNItem.set(parsed.data.nItem, { qty: parsed.data.qty, isProduced: parsed.data.isProduced });
    }

    const reasonCode = ReversalReasonCodeSchema.parse(reversalRow.reason_code);

    const inboundDraft = buildInboundReversalNfe({
        outboundDraft,
        outboundAccessKey: String(outboundRow.access_key),
        mode: reversalRow.mode,
        selectionByNItem,
        reasonCode,
        reasonOther: reversalRow.reason_other,
        nowIso,
    });

    // keep key params aligned to generated access key
    inboundDraft.ide.cDV = cDV;
    inboundDraft.ide.chNFe = chNFe;
    inboundDraft.ide.cNF = cNF;

    // Build/sign/transmit
    const xml = buildNfeXml(inboundDraft, { mode: "transmissible", tzOffset: "-03:00" }).xml;
    const certData = await loadCompanyCertificate(args.companyId);
    const idLote = Date.now().toString().slice(-15);

    const result = await emitirNfeHomolog(inboundDraft, certData, idLote, {
        companyId: args.companyId,
        accessKey: chNFe,
    });

    const signedXml = result.nfeXmlAssinado;
    const protocolXml = result.protNFeXml;
    const cStat = result.cStat;
    const xMotivo = result.xMotivo;

    const docId = String(outboundRow.sales_document_id);
    const nfeIdForArtifacts = reversalRow.id;

    const [xmlPath, signedPath, protocolPath] = await Promise.all([
        uploadNfeArtifact(args.companyId, docId, nfeIdForArtifacts, "nfe.xml", xml),
        uploadNfeArtifact(args.companyId, docId, nfeIdForArtifacts, "nfe-signed.xml", signedXml),
        protocolXml ? uploadNfeArtifact(args.companyId, docId, nfeIdForArtifacts, "nfe-prot.xml", protocolXml) : Promise.resolve(null),
    ]);

    const emissionStatus =
        cStat === "100" ? "authorized" :
            (cStat === "103" || cStat === "105") ? "processing" :
                "rejected";

    const record = await upsertNfeEmission({
        company_id: args.companyId,
        sales_document_id: docId,
        access_key: chNFe,
        numero: String(nNF),
        serie: String(serie),
        tp_amb: tpAmb,
        uf: ufState,
        xml_signed: signedXml,
        xml_sent: signedPath.path,
        status: emissionStatus,
        c_stat: cStat,
        x_motivo: xMotivo,
        id_lote: idLote,
        xml_unsigned: xml,
        xml_nfe_proc: protocolXml && cStat === "100" ? buildNfeProc(signedXml, protocolXml) : undefined,
    });

    await admin
        .from("nfe_inbound_reversals")
        .update({
            inbound_emission_id: record.id,
            status: cStat === "100" ? "authorized" : (emissionStatus === "processing" ? "processing" : "failed"),
            c_stat: cStat,
            x_motivo: xMotivo,
            updated_at: new Date().toISOString(),
        })
        .eq("id", reversalRow.id)
        .eq("company_id", args.companyId);

    // increment counter (best-effort, same behavior as emitOffline)
    await admin
        .from("company_settings")
        .update({ nfe_next_number: Number(nNF) + 1 })
        .eq("company_id", args.companyId);

    if (cStat !== "100") {
        throw new Error(`Transmissão: ${cStat} - ${xMotivo}`);
    }

    return {
        success: true,
        inboundEmissionId: record.id!,
        accessKey: chNFe,
        artifacts: {
            xml: xmlPath.path,
            signed_xml: signedPath.path,
            protocol: protocolPath?.path || null,
        },
    };
}
