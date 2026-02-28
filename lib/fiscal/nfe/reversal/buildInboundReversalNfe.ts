import { NfeDest, NfeDraft, NfeEmit, NfeImposto, NfeItem, NfePag } from "@/lib/nfe/domain/types";
import { buildReversalInfCpl, REVERSAL_NATOP, ReversalReasonCode } from "./texts";

function round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function scaleMaybeNumber(value: unknown, ratio: number): number | undefined {
    if (value === null || value === undefined) return undefined;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return undefined;
    return round2(n * ratio);
}

const MONEY_TOLERANCE = 0.01;
const QTY_TOLERANCE = 0.0001;

function normalizeDocument(document: string): string {
    return String(document || "").replace(/\D/g, "");
}

function assertMoneyClose(actual: number, expected: number, message: string): void {
    if (Math.abs(actual - expected) > MONEY_TOLERANCE) {
        throw new Error(`${message} (esperado ${expected.toFixed(2)}, obtido ${actual.toFixed(2)}).`);
    }
}

export interface ReturnItemMappingInput {
    order: number;
    nItem: number;
    cProd: string;
    ncm: string;
    vUnCom: number;
    qCom: number;
    vProd: number;
}

interface ReturnItemMapping {
    returnItem: ReturnItemMappingInput;
    originalItem: NfeItem;
    ratio: number;
}

export interface ReturnNfeItemTotals {
    vBC: number;
    vICMS: number;
    vPIS: number;
    vCOFINS: number;
    vProd: number;
    vFrete: number;
    vSeg: number;
    vDesc: number;
    vOutro: number;
    vNF: number;
}

function buildMappingKey(input: Pick<ReturnItemMappingInput, "cProd" | "ncm" | "vUnCom">): string {
    return `${input.cProd}::${input.ncm}::${round2(input.vUnCom).toFixed(2)}`;
}

function mapInboundCfop(args: { idDest: "1" | "2" | "3"; isProduced: boolean }): string {
    const interstate = args.idDest === "2";
    if (args.isProduced) return interstate ? "2201" : "1201";
    return interstate ? "2202" : "1202";
}

function inferInboundStCfopFromOutboundCfop(outboundCfop: string, idDest: "1" | "2" | "3"): string | null {
    const digits = String(outboundCfop || "").replace(/\D/g, "");
    if (digits.length !== 4) return null;
    // We only infer from outbound sale CFOPs (5xxx/6xxx/7xxx).
    if (!["5", "6", "7"].includes(digits[0])) return null;
    const interstate = idDest === "2";
    const suffix = digits.slice(-3);
    // ST sales: 5401/6401 (producao sujeita a ST) => devolucao 1410/2410
    if (suffix === "401" || suffix === "402") return interstate ? "2410" : "1410";
    // ST sales of third-party: 5403/5405/6403/6404/6405 (varies by UF) => devolucao 1411/2411
    if (suffix === "403" || suffix === "404" || suffix === "405") return interstate ? "2411" : "1411";
    return null;
}

function inferInboundRegularCfopFromOutboundCfop(outboundCfop: string, idDest: "1" | "2" | "3"): string | null {
    const digits = String(outboundCfop || "").replace(/\D/g, "");
    if (digits.length !== 4) return null;
    // We only infer from outbound sale CFOPs (5xxx/6xxx/7xxx).
    if (!["5", "6", "7"].includes(digits[0])) return null;
    const interstate = idDest === "2";
    const suffix = digits.slice(-3);
    if (suffix === "101") return interstate ? "2201" : "1201"; // venda de producao do estabelecimento
    if (suffix === "102") return interstate ? "2202" : "1202"; // venda de mercadoria adquirida/terceiros
    return null;
}

export function assertDestNotEqualEmit(emit: NfeEmit, dest: NfeDest): void {
    const emitDoc = normalizeDocument(emit.cnpj);
    const destDoc = normalizeDocument(dest.cpfOuCnpj);
    if (!emitDoc || !destDoc) {
        throw new Error("Emitente/Destinatário inválidos: documento ausente.");
    }
    if (emitDoc === destDoc) {
        throw new Error("Destinatário da devolução não pode ser igual ao emitente.");
    }
}

export function mapReturnItemsToOriginalItems(
    returnItems: ReturnItemMappingInput[],
    originalItems: NfeItem[],
): ReturnItemMapping[] {
    const originalsByKey = new Map<string, NfeItem[]>();
    const sortedOriginals = [...originalItems].sort((a, b) => a.nItem - b.nItem);

    for (const originalItem of sortedOriginals) {
        const key = buildMappingKey({
            cProd: originalItem.prod.cProd,
            ncm: originalItem.prod.ncm,
            vUnCom: originalItem.prod.vUnCom,
        });
        const bucket = originalsByKey.get(key);
        if (bucket) bucket.push(originalItem);
        else originalsByKey.set(key, [originalItem]);
    }

    const usedOriginalNItems = new Set<number>();
    const mappings: ReturnItemMapping[] = [];
    const sortedReturnItems = [...returnItems].sort((a, b) => a.order - b.order);

    for (const returnItem of sortedReturnItems) {
        const key = buildMappingKey(returnItem);
        const candidates = originalsByKey.get(key) || [];

        const preferredByNItem = candidates.find((candidate) => candidate.nItem === returnItem.nItem && !usedOriginalNItems.has(candidate.nItem));
        const originalItem = preferredByNItem || candidates.find((candidate) => !usedOriginalNItems.has(candidate.nItem));

        if (!originalItem) {
            throw new Error(
                `Não foi possível mapear item de devolução (ordem ${returnItem.order + 1}, cProd ${returnItem.cProd}) para a NF-e de saída.`,
            );
        }

        if (returnItem.qCom <= 0) {
            throw new Error(`Quantidade inválida no item de devolução (ordem ${returnItem.order + 1}).`);
        }

        if (returnItem.qCom - originalItem.prod.qCom > QTY_TOLERANCE) {
            throw new Error(
                `Quantidade da devolução maior que a quantidade original no item ${originalItem.nItem}.`,
            );
        }

        const expectedVProd = round2(returnItem.qCom * originalItem.prod.vUnCom);
        assertMoneyClose(
            round2(returnItem.vProd),
            expectedVProd,
            `Valor total inconsistente no item ${originalItem.nItem}`,
        );

        const ratio = originalItem.prod.qCom > 0 ? returnItem.qCom / originalItem.prod.qCom : 0;
        if (ratio <= 0 || ratio > 1 + QTY_TOLERANCE) {
            throw new Error(`Não foi possível calcular proporção válida para o item ${originalItem.nItem}.`);
        }

        usedOriginalNItems.add(originalItem.nItem);
        mappings.push({
            returnItem,
            originalItem,
            ratio,
        });
    }

    if (mappings.length !== returnItems.length) {
        throw new Error("Falha no mapeamento 1:1 entre itens da devolução e da saída.");
    }

    return mappings;
}

export function cloneTaxesFromOriginalItem(originalItem: NfeItem, ratio: number): NfeImposto {
    if (!originalItem.imposto.icms) {
        throw new Error(`Item ${originalItem.nItem} da NF-e de saída sem grupo ICMS. Não é possível espelhar tributos.`);
    }
    if (!originalItem.imposto.pis) {
        throw new Error(`Item ${originalItem.nItem} da NF-e de saída sem grupo PIS. Não é possível espelhar tributos.`);
    }
    if (!originalItem.imposto.cofins) {
        throw new Error(`Item ${originalItem.nItem} da NF-e de saída sem grupo COFINS. Não é possível espelhar tributos.`);
    }

    return {
        icms: {
            ...originalItem.imposto.icms,
            vBC: scaleMaybeNumber(originalItem.imposto.icms.vBC, ratio),
            vICMS: scaleMaybeNumber(originalItem.imposto.icms.vICMS, ratio),
            vCredICMSSN: scaleMaybeNumber(originalItem.imposto.icms.vCredICMSSN, ratio),
        },
        pis: {
            ...originalItem.imposto.pis,
            vBC: scaleMaybeNumber(originalItem.imposto.pis.vBC, ratio),
            vPIS: scaleMaybeNumber(originalItem.imposto.pis.vPIS, ratio),
        },
        cofins: {
            ...originalItem.imposto.cofins,
            vBC: scaleMaybeNumber(originalItem.imposto.cofins.vBC, ratio),
            vCOFINS: scaleMaybeNumber(originalItem.imposto.cofins.vCOFINS, ratio),
        },
        vTotTrib: scaleMaybeNumber(originalItem.imposto.vTotTrib, ratio),
    };
}

export function buildTotalsFromItems(items: NfeItem[]): ReturnNfeItemTotals {
    const totals: ReturnNfeItemTotals = {
        vBC: 0,
        vICMS: 0,
        vPIS: 0,
        vCOFINS: 0,
        vProd: 0,
        vFrete: 0,
        vSeg: 0,
        vDesc: 0,
        vOutro: 0,
        vNF: 0,
    };

    for (const item of items) {
        const expectedVProd = round2(item.prod.qCom * item.prod.vUnCom);
        assertMoneyClose(round2(item.prod.vProd), expectedVProd, `vProd inconsistente no item ${item.nItem}`);

        totals.vProd = round2(totals.vProd + item.prod.vProd);
        totals.vFrete = round2(totals.vFrete + (item.vFrete || 0));
        totals.vSeg = round2(totals.vSeg + (item.vSeg || 0));
        totals.vDesc = round2(totals.vDesc + (item.vDesc || 0));
        totals.vOutro = round2(totals.vOutro + (item.vOutro || 0));
        totals.vBC = round2(totals.vBC + (item.imposto.icms?.vBC || 0));
        totals.vICMS = round2(totals.vICMS + (item.imposto.icms?.vICMS || 0));
        totals.vPIS = round2(totals.vPIS + (item.imposto.pis?.vPIS || 0));
        totals.vCOFINS = round2(totals.vCOFINS + (item.imposto.cofins?.vCOFINS || 0));
    }

    totals.vNF = round2(totals.vProd - totals.vDesc + totals.vFrete + totals.vSeg + totals.vOutro);
    return totals;
}

export function stripBillingSectionsForReturnNfe(): { pag: NfePag; cobr?: undefined } {
    return {
        pag: {
            detPag: [{
                indPag: "0",
                tPag: "90",
                vPag: 0,
            }],
        },
    };
}

export function buildInboundReversalNfe(args: {
    outboundDraft: NfeDraft;
    outboundAccessKey: string;
    mode: "TOTAL" | "PARCIAL";
    selectionByNItem: Map<number, { qty: number; isProduced: boolean }>;
    reasonCode: ReversalReasonCode;
    reasonOther?: string | null;
    nowIso: string;
}): NfeDraft {
    const isPartial = args.mode === "PARCIAL";

    const outbound = args.outboundDraft;
    const ide = {
        ...outbound.ide,
        tpNF: "0" as const,
        finNFe: "4" as const,
        natOp: REVERSAL_NATOP,
        dhEmi: args.nowIso,
        NFref: [{ refNFe: args.outboundAccessKey }],
    };

    const emit = { ...outbound.emit, enderEmit: { ...outbound.emit.enderEmit } };

    const dest: NfeDest = {
        ...outbound.dest,
        enderDest: { ...outbound.dest.enderDest },
    };
    assertDestNotEqualEmit(emit, dest);

    const itemsWithoutTaxes: Array<{ sourceNItem: number; item: NfeItem }> = [];

    for (const item of outbound.itens) {
        const originalQty = item.prod.qCom;
        const stCfopFromOutbound = inferInboundStCfopFromOutboundCfop(item.prod.cfop, outbound.ide.idDest);
        const regularCfopFromOutbound = isPartial
            ? null
            : inferInboundRegularCfopFromOutboundCfop(item.prod.cfop, outbound.ide.idDest);
        const selected = isPartial
            ? args.selectionByNItem.get(item.nItem) || null
            : { qty: originalQty, isProduced: false };

        if (!selected || selected.qty <= 0) continue;
        if (selected.qty > originalQty) {
            throw new Error(`Quantidade de estorno maior que o original no item ${item.nItem}.`);
        }

        const ratio = originalQty > 0 ? selected.qty / originalQty : 0;

        const qCom = selected.qty;
        const qTrib = (item.prod.qCom > 0)
            ? round2((item.prod.qTrib / item.prod.qCom) * qCom)
            : qCom;

        const vUnCom = item.prod.vUnCom;
        const vProd = round2(vUnCom * qCom);

        const cfop = stCfopFromOutbound
            ?? regularCfopFromOutbound
            ?? mapInboundCfop({ idDest: outbound.ide.idDest, isProduced: selected.isProduced });

        itemsWithoutTaxes.push({
            sourceNItem: item.nItem,
            item: {
                ...item,
                prod: {
                    ...item.prod,
                    cfop,
                    qCom,
                    qTrib,
                    vProd,
                },
                imposto: {
                    ...item.imposto,
                },
                vDesc: scaleMaybeNumber(item.vDesc, ratio),
                vFrete: scaleMaybeNumber(item.vFrete, ratio),
                vOutro: scaleMaybeNumber(item.vOutro, ratio),
                vSeg: scaleMaybeNumber(item.vSeg, ratio),
            },
        });
    }

    if (itemsWithoutTaxes.length === 0) {
        throw new Error("Selecione ao menos 1 item para estorno.");
    }

    const mappingInput: ReturnItemMappingInput[] = itemsWithoutTaxes.map((entry, index) => ({
        order: index,
        nItem: entry.sourceNItem,
        cProd: entry.item.prod.cProd,
        ncm: entry.item.prod.ncm,
        vUnCom: entry.item.prod.vUnCom,
        qCom: entry.item.prod.qCom,
        vProd: entry.item.prod.vProd,
    }));

    const mappedItems = mapReturnItemsToOriginalItems(mappingInput, outbound.itens);
    const mappedByOrder = new Map<number, ReturnItemMapping>(mappedItems.map((mapped) => [mapped.returnItem.order, mapped]));

    const itens: NfeItem[] = itemsWithoutTaxes.map((entry, index) => {
        const mapped = mappedByOrder.get(index);
        if (!mapped) {
            throw new Error(`Falha ao encontrar mapeamento do item de devolução na ordem ${index + 1}.`);
        }
        return {
            ...entry.item,
            imposto: cloneTaxesFromOriginalItem(mapped.originalItem, mapped.ratio),
        };
    });

    const totals = buildTotalsFromItems(itens);
    const mirroredFromOriginal = mappedItems.reduce<Pick<ReturnNfeItemTotals, "vBC" | "vICMS" | "vPIS" | "vCOFINS">>(
        (acc, mapped) => {
            acc.vBC = round2(acc.vBC + ((mapped.originalItem.imposto.icms?.vBC || 0) * mapped.ratio));
            acc.vICMS = round2(acc.vICMS + ((mapped.originalItem.imposto.icms?.vICMS || 0) * mapped.ratio));
            acc.vPIS = round2(acc.vPIS + ((mapped.originalItem.imposto.pis?.vPIS || 0) * mapped.ratio));
            acc.vCOFINS = round2(acc.vCOFINS + ((mapped.originalItem.imposto.cofins?.vCOFINS || 0) * mapped.ratio));
            return acc;
        },
        { vBC: 0, vICMS: 0, vPIS: 0, vCOFINS: 0 },
    );

    assertMoneyClose(totals.vBC, mirroredFromOriginal.vBC, "Total vBC divergente dos itens espelhados");
    assertMoneyClose(totals.vICMS, mirroredFromOriginal.vICMS, "Total vICMS divergente dos itens espelhados");
    assertMoneyClose(totals.vPIS, mirroredFromOriginal.vPIS, "Total vPIS divergente dos itens espelhados");
    assertMoneyClose(totals.vCOFINS, mirroredFromOriginal.vCOFINS, "Total vCOFINS divergente dos itens espelhados");

    const billingStripped = stripBillingSectionsForReturnNfe();

    const infCpl = buildReversalInfCpl({
        outboundAccessKey: args.outboundAccessKey,
        reasonCode: args.reasonCode,
        reasonOther: args.reasonOther,
        isPartial,
    });

    return {
        ide,
        emit,
        dest,
        itens: itens.map((i, idx) => ({ ...i, nItem: idx + 1 })), // re-number sequentially
        transp: { modFrete: "9" },
        ...billingStripped,
        infAdic: { infCpl },
    };
}
