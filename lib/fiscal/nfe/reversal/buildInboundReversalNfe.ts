import { NfeDraft, NfeItem, NfePag } from "@/lib/nfe/domain/types";
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

    const destName = ide.tpAmb === "2"
        ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
        : emit.xNome;

    const dest = {
        cpfOuCnpj: emit.cnpj,
        xNome: destName.slice(0, 60),
        indIEDest: "1" as const,
        ie: emit.ie,
        enderDest: { ...emit.enderEmit },
    };

    const itens: NfeItem[] = [];

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

        itens.push({
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
                icms: item.imposto.icms
                    ? {
                        ...item.imposto.icms,
                        vBC: scaleMaybeNumber(item.imposto.icms.vBC, ratio),
                        vICMS: scaleMaybeNumber(item.imposto.icms.vICMS, ratio),
                        vCredICMSSN: scaleMaybeNumber(item.imposto.icms.vCredICMSSN, ratio),
                    }
                    : undefined,
                pis: item.imposto.pis
                    ? {
                        ...item.imposto.pis,
                        vBC: scaleMaybeNumber(item.imposto.pis.vBC, ratio),
                        vPIS: scaleMaybeNumber(item.imposto.pis.vPIS, ratio),
                    }
                    : undefined,
                cofins: item.imposto.cofins
                    ? {
                        ...item.imposto.cofins,
                        vBC: scaleMaybeNumber(item.imposto.cofins.vBC, ratio),
                        vCOFINS: scaleMaybeNumber(item.imposto.cofins.vCOFINS, ratio),
                    }
                    : undefined,
                vTotTrib: scaleMaybeNumber(item.imposto.vTotTrib, ratio),
            },
            vDesc: scaleMaybeNumber(item.vDesc, ratio),
            vFrete: scaleMaybeNumber(item.vFrete, ratio),
            vOutro: scaleMaybeNumber(item.vOutro, ratio),
            vSeg: scaleMaybeNumber(item.vSeg, ratio),
        });
    }

    if (itens.length === 0) {
        throw new Error("Selecione ao menos 1 item para estorno.");
    }

    const pag: NfePag = {
        detPag: [{
            indPag: "0",
            tPag: "90", // Sem pagamento
            vPag: 0,
        }],
    };

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
        pag,
        infAdic: { infCpl },
    };
}
