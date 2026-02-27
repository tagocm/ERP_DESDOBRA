import { createAdminClient } from "@/lib/supabaseServer";
import { buildNfeXml } from "@/lib/nfe/xml/buildNfeXml";
import { uploadNfeArtifact } from "@/lib/fiscal/nfe/offline/storage";
import { emitirNfeHomolog } from "@/lib/nfe/sefaz/services/emitir";
import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { buildNfeProc, upsertNfeEmission } from "@/lib/nfe/sefaz/services/persistence";
import { buildDraftFromDb } from "@/lib/fiscal/nfe/offline/mappers";
import { buildInboundReversalNfe } from "./buildInboundReversalNfe";
import type { NfeDraft, NfeEndereco } from "@/lib/nfe/domain/types";
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
    ie: z.string().nullable().optional(),
    tax_regime: z.string().nullable().optional(),
    legal_name: z.string().nullable().optional(),
    trade_name: z.string().nullable().optional(),
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
    source_system: z.string().nullable().optional(),
    emit_uf: z.string().nullable().optional(),
    dest_document: z.string().nullable().optional(),
    dest_uf: z.string().nullable().optional(),
});

const LegacyImportedItemSchema = z.object({
    item_number: z.coerce.number().int().positive(),
    cprod: z.string().nullable().optional(),
    xprod: z.string().nullable().optional(),
    ncm: z.string().nullable().optional(),
    cfop: z.string().nullable().optional(),
    ucom: z.string().nullable().optional(),
    qcom: z.coerce.number().positive(),
    vuncom: z.coerce.number().nonnegative(),
    vprod: z.coerce.number().nonnegative(),
    is_produced: z.boolean().nullable().optional(),
}).passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function cleanDigits(value: string | null | undefined): string {
    return String(value || "").replace(/\D/g, "");
}

function toNonEmpty(value: string | null | undefined, fallback: string): string {
    const trimmed = String(value || "").trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function toNfeEndereco(address: {
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    city_code_ibge?: string | null;
}): NfeEndereco {
    const uf = toNonEmpty(address.state, "SP").toUpperCase();
    const cityCode = cleanDigits(address.city_code_ibge).slice(0, 7) || `${getIbgeUf(uf)}0000`;
    const zip = cleanDigits(address.zip).slice(0, 8) || "00000000";

    return {
        xLgr: toNonEmpty(address.street, "SEM LOGRADOURO").slice(0, 60),
        nro: toNonEmpty(address.number, "SN").slice(0, 60),
        xBairro: toNonEmpty(address.neighborhood, "GERAL").slice(0, 60),
        cMun: cityCode,
        xMun: toNonEmpty(address.city, "CIDADE").slice(0, 60),
        uf,
        cep: zip,
        cPais: "1058",
        xPais: "BRASIL",
    };
}

function normalizeCfop(value: string | null | undefined, fallback: string): string {
    const digits = cleanDigits(value);
    return digits.length === 4 ? digits : fallback;
}

function buildLegacyOutboundDraft(args: {
    outbound: z.infer<typeof OutboundEmissionSchema>;
    items: Array<z.infer<typeof LegacyImportedItemSchema>>;
    nowIso: string;
    tpAmb: "1" | "2";
    company: {
        cnpj: string;
        ie: string;
        legalName: string;
        tradeName: string;
        crt: "1" | "3";
        endereco: NfeEndereco;
    };
}): NfeDraft {
    const idDest: "1" | "2" = args.outbound.emit_uf && args.outbound.dest_uf && args.outbound.emit_uf === args.outbound.dest_uf ? "1" : "2";
    const fallbackCfop = idDest === "2" ? "6102" : "5102";
    const destinationDocument = cleanDigits(args.outbound.dest_document);
    const destinationName = args.tpAmb === "2"
        ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
        : "DESTINATARIO LEGADO";

    return {
        ide: {
            cUF: getIbgeUf(args.company.endereco.uf),
            natOp: "VENDA DE MERCADORIA",
            mod: "55",
            serie: "1",
            nNF: "1",
            dhEmi: args.nowIso,
            tpNF: "1",
            idDest,
            cMunFG: args.company.endereco.cMun,
            tpImp: "1",
            tpEmis: "1",
            tpAmb: args.tpAmb,
            finNFe: "1",
            indFinal: "1",
            indPres: "1",
            procEmi: "0",
            verProc: "ERP_DESDOBRA_1.0",
        },
        emit: {
            cnpj: args.company.cnpj,
            xNome: args.company.legalName.slice(0, 60),
            xFant: args.company.tradeName.slice(0, 60),
            ie: args.company.ie,
            crt: args.company.crt,
            enderEmit: args.company.endereco,
        },
        dest: {
            cpfOuCnpj: destinationDocument.length === 11 || destinationDocument.length === 14
                ? destinationDocument
                : args.company.cnpj,
            xNome: destinationName.slice(0, 60),
            indIEDest: "9",
            enderDest: args.company.endereco,
        },
        itens: args.items.map((item) => {
            const quantity = item.qcom;
            const unitPrice = item.vuncom;
            const total = item.vprod > 0 ? item.vprod : quantity * unitPrice;
            const cProd = toNonEmpty(item.cprod, `LEGACY-${item.item_number}`);
            const xProd = toNonEmpty(item.xprod, `Item legado ${item.item_number}`);
            const ncm = cleanDigits(item.ncm).slice(0, 8) || "00000000";
            const uCom = toNonEmpty(item.ucom, "UN");

            return {
                nItem: item.item_number,
                prod: {
                    cProd: cProd.slice(0, 60),
                    xProd: xProd.slice(0, 120),
                    ncm,
                    cfop: normalizeCfop(item.cfop, fallbackCfop),
                    uCom: uCom.slice(0, 6),
                    qCom: quantity,
                    vUnCom: unitPrice,
                    vProd: total,
                    cean: "SEM GTIN",
                    ceanTrib: "SEM GTIN",
                    uTrib: uCom.slice(0, 6),
                    qTrib: quantity,
                    vUnTrib: unitPrice,
                },
                imposto: {
                    vTotTrib: 0,
                },
            };
        }),
        transp: {
            modFrete: "9",
        },
        pag: {
            detPag: [
                {
                    indPag: "0",
                    tPag: "90",
                    vPag: 0,
                },
            ],
        },
    };
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
        .select("id, company_id, sales_document_id, access_key, status, source_system, emit_uf, dest_document, dest_uf")
        .eq("id", reversalRow.outbound_emission_id)
        .eq("company_id", args.companyId)
        .maybeSingle();

    if (outboundError) throw new Error(`Falha ao carregar NF-e de saída: ${outboundError.message}`);
    if (!outbound) throw new Error("NF-e de saída não encontrada.");
    const outboundRow = OutboundEmissionSchema.parse(outbound);
    if (outboundRow.status !== "authorized") throw new Error("NF-e de saída precisa estar AUTORIZADA.");
    if (!outboundRow.access_key || String(outboundRow.access_key).length !== 44) throw new Error("Chave de acesso inválida na NF-e de saída.");

    // Mark processing (best-effort)
    await admin
        .from("nfe_inbound_reversals")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", reversalRow.id)
        .eq("company_id", args.companyId);

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

    const companyCnpj = cleanDigits(settings.cnpj || companyRow.document_number);
    if (companyCnpj.length !== 14) {
        throw new Error("CNPJ da empresa inválido para emissão de estorno.");
    }

    const companyIe = cleanDigits(settings.ie);
    if (!companyIe) {
        throw new Error("Inscrição Estadual da empresa não configurada.");
    }

    const fiscalAddress = toNfeEndereco({
        street: selectedAddress?.street,
        number: selectedAddress?.number,
        neighborhood: selectedAddress?.neighborhood,
        city: selectedAddress?.city,
        state: selectedAddress?.state,
        zip: selectedAddress?.zip,
        city_code_ibge: selectedAddress?.city_code_ibge,
    });

    const outboundDraft = (() => {
        if (outboundRow.sales_document_id) {
            return (async () => {
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

                return buildDraftFromDb({
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
            })();
        }

        if (outboundRow.source_system !== "LEGACY_IMPORT") {
            throw new Error("NF-e de saída sem pedido vinculado. Não é possível gerar estorno automaticamente.");
        }

        return (async () => {
            const { data: importedItemsRaw, error: importedItemsError } = await admin
                .from("nfe_legacy_import_items")
                .select("item_number,cprod,xprod,ncm,cfop,ucom,qcom,vuncom,vprod,is_produced")
                .eq("company_id", args.companyId)
                .eq("nfe_emission_id", outboundRow.id)
                .order("item_number", { ascending: true });

            if (importedItemsError) {
                throw new Error(`Falha ao carregar itens importados da NF-e legada: ${importedItemsError.message}`);
            }

            const importedItems = (importedItemsRaw || []).map((row) => LegacyImportedItemSchema.parse(row));
            if (importedItems.length === 0) {
                throw new Error("NF-e legada sem itens importados para gerar estorno.");
            }

            const crt: "1" | "3" = settings.tax_regime === "simples_nacional" ? "1" : "3";
            return buildLegacyOutboundDraft({
                outbound: outboundRow,
                items: importedItems,
                nowIso,
                tpAmb,
                company: {
                    cnpj: companyCnpj,
                    ie: companyIe,
                    legalName: toNonEmpty(settings.legal_name, String((baseCompany as { name?: string }).name || "EMPRESA")),
                    tradeName: toNonEmpty(settings.trade_name, String((baseCompany as { trade_name?: string }).trade_name || (baseCompany as { slug?: string }).slug || "EMPRESA")),
                    crt,
                    endereco: fiscalAddress,
                },
            });
        })();
    })();

    const resolvedOutboundDraft = await outboundDraft;

    resolvedOutboundDraft.ide.cDV = cDV;
    resolvedOutboundDraft.ide.chNFe = chNFe;
    resolvedOutboundDraft.ide.cNF = cNF;

    const selectionParsed = Array.isArray(reversal.selection) ? reversal.selection : [];
    const selectionByNItem = new Map<number, { qty: number; isProduced: boolean }>();
    for (const raw of selectionParsed) {
        const parsed = ReversalSelectionItemSchema.safeParse(raw);
        if (!parsed.success) continue;
        selectionByNItem.set(parsed.data.nItem, { qty: parsed.data.qty, isProduced: parsed.data.isProduced });
    }

    const reasonCode = ReversalReasonCodeSchema.parse(reversalRow.reason_code);

    const inboundDraft = buildInboundReversalNfe({
        outboundDraft: resolvedOutboundDraft,
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

    const docId = outboundRow.sales_document_id ? String(outboundRow.sales_document_id) : "legacy-import";
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
        sales_document_id: outboundRow.sales_document_id ? docId : undefined,
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
