import { NfeDraft, NfeItem } from "@/lib/nfe/domain/types";
import { describe, expect, it } from "vitest";
import {
    buildInboundReversalNfe,
    buildTotalsFromItems,
    mapReturnItemsToOriginalItems,
} from "../buildInboundReversalNfe";

function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function makeTaxedItem(nItem: number, qty: number, vUnCom: number): NfeItem {
    const vProd = round2(qty * vUnCom);
    const vBC = round2(vProd * 0.6667); // pRedBC=33.33
    const vICMS = round2(vBC * 0.18);
    const vPIS = round2(vProd * 0.0065);
    const vCOFINS = round2(vProd * 0.03);

    return {
        nItem,
        prod: {
            cProd: `SKU${nItem}`,
            xProd: `Produto ${nItem}`,
            ncm: "01010101",
            cfop: "5101",
            uCom: "UN",
            qCom: qty,
            vUnCom,
            vProd,
            cean: "SEM GTIN",
            ceanTrib: "SEM GTIN",
            uTrib: "UN",
            qTrib: qty,
            vUnTrib: vUnCom,
        },
        imposto: {
            icms: {
                orig: "0",
                cst: "20",
                modBC: "3",
                pRedBC: 33.33,
                vBC,
                pICMS: 18,
                vICMS,
            },
            pis: {
                cst: "01",
                vBC: vProd,
                pPIS: 0.65,
                vPIS: vPIS,
            },
            cofins: {
                cst: "01",
                vBC: vProd,
                pCOFINS: 3,
                vCOFINS: vCOFINS,
            },
            vTotTrib: round2(vICMS + vPIS + vCOFINS),
        },
    };
}

function sampleOutboundDraft(): NfeDraft {
    return {
        ide: {
            cUF: "35",
            natOp: "VENDA",
            mod: "55",
            serie: "1",
            nNF: "10",
            dhEmi: "2026-02-23T10:00:00.000-03:00",
            tpNF: "1",
            idDest: "1",
            cMunFG: "3550308",
            tpImp: "1",
            tpEmis: "1",
            tpAmb: "1",
            finNFe: "1",
            indFinal: "1",
            indPres: "1",
            procEmi: "0",
            verProc: "ERP",
            cNF: "12345678",
            chNFe: "3".repeat(44),
        },
        emit: {
            cnpj: "03645616000108",
            xNome: "EMPRESA TESTE",
            ie: "123",
            crt: "3",
            enderEmit: {
                xLgr: "Rua A",
                nro: "1",
                xBairro: "Centro",
                cMun: "3550308",
                xMun: "SAO PAULO",
                uf: "SP",
                cep: "01001000",
            },
        },
        dest: {
            cpfOuCnpj: "11111111000111",
            xNome: "CLIENTE ORIGINAL",
            indIEDest: "1",
            ie: "99887766",
            email: "cliente.original@teste.com.br",
            enderDest: {
                xLgr: "Rua Cliente",
                nro: "200",
                xBairro: "Bairro Cliente",
                cMun: "3550308",
                xMun: "SAO PAULO",
                uf: "SP",
                cep: "01002000",
            },
        },
        itens: [
            makeTaxedItem(1, 2, 10),
            makeTaxedItem(2, 3, 20),
            makeTaxedItem(3, 4, 5),
            makeTaxedItem(4, 1, 150),
            makeTaxedItem(5, 6, 12.5),
        ],
        cobr: {
            fat: { nFat: "10", vOrig: 315, vLiq: 315 },
            dup: [{ nDup: "001", dVenc: "2026-03-10", vDup: 315 }],
        },
        pag: {
            detPag: [{ indPag: "1", tPag: "15", vPag: 315 }],
        },
    };
}

describe("buildInboundReversalNfe", () => {
    it("caso feliz: espelha destinatário, impostos e totais, sem cobr e pagamento indevido", () => {
        const draft = sampleOutboundDraft();
        const out = buildInboundReversalNfe({
            outboundDraft: draft,
            outboundAccessKey: "1".repeat(44),
            mode: "TOTAL",
            selectionByNItem: new Map(),
            reasonCode: "MERCADORIA_NAO_ENTREGUE",
            nowIso: "2026-02-23T12:00:00.000-03:00",
        });

        expect(out.ide.tpNF).toBe("0");
        expect(out.ide.finNFe).toBe("4");
        expect(out.ide.NFref?.[0]?.refNFe).toBe("1".repeat(44));

        expect(out.dest.cpfOuCnpj).toBe(draft.dest.cpfOuCnpj);
        expect(out.dest.xNome).toBe(draft.dest.xNome);
        expect(out.dest.ie).toBe(draft.dest.ie);
        expect(out.dest.email).toBe(draft.dest.email);
        expect(out.dest.cpfOuCnpj).not.toBe(out.emit.cnpj);

        expect(out.cobr).toBeUndefined();
        expect(out.pag.detPag).toHaveLength(1);
        expect(out.pag.detPag[0]).toEqual({ indPag: "0", tPag: "90", vPag: 0 });

        expect(out.itens).toHaveLength(5);
        out.itens.forEach((item, index) => {
            const original = draft.itens[index];
            expect(item.prod.cProd).toBe(original.prod.cProd);
            expect(item.prod.xProd).toBe(original.prod.xProd);
            expect(item.prod.ncm).toBe(original.prod.ncm);
            expect(item.prod.qCom).toBe(original.prod.qCom);
            expect(item.prod.vUnCom).toBe(original.prod.vUnCom);
            expect(item.prod.vProd).toBe(original.prod.vProd);
            expect(item.imposto.icms?.cst).toBe("20");
            expect(item.imposto.pis?.cst).toBe("01");
            expect(item.imposto.cofins?.cst).toBe("01");
            expect(item.imposto.icms).toEqual(original.imposto.icms);
            expect(item.imposto.pis).toEqual(original.imposto.pis);
            expect(item.imposto.cofins).toEqual(original.imposto.cofins);
        });

        const totals = buildTotalsFromItems(out.itens);
        expect(totals.vProd).toBe(325);
        expect(totals.vBC).toBe(216.67);
        expect(totals.vICMS).toBe(39);
        expect(totals.vPIS).toBe(2.12);
        expect(totals.vCOFINS).toBe(9.75);
        expect(totals.vNF).toBe(325);
    });

    it("caso erro: destinatário igual ao emitente deve falhar", () => {
        const draft = sampleOutboundDraft();
        draft.dest.cpfOuCnpj = draft.emit.cnpj;

        expect(() =>
            buildInboundReversalNfe({
                outboundDraft: draft,
                outboundAccessKey: "1".repeat(44),
                mode: "TOTAL",
                selectionByNItem: new Map(),
                reasonCode: "MERCADORIA_NAO_ENTREGUE",
                nowIso: "2026-02-23T12:00:00.000-03:00",
            }),
        ).toThrow("Destinatário da devolução não pode ser igual ao emitente.");
    });

    it("caso erro: mapeamento de itens sem correspondência 1:1 deve falhar", () => {
        const originalItems = sampleOutboundDraft().itens;

        expect(() =>
            mapReturnItemsToOriginalItems(
                [{
                    order: 0,
                    nItem: 999,
                    cProd: "SEM-CORRESPONDENCIA",
                    ncm: "01010101",
                    vUnCom: 10,
                    qCom: 1,
                    vProd: 10,
                }],
                originalItems,
            ),
        ).toThrow("Não foi possível mapear item de devolução");
    });

    it("caso regressão: CFOP 1201 deve permanecer", () => {
        const draft = sampleOutboundDraft();
        const out = buildInboundReversalNfe({
            outboundDraft: draft,
            outboundAccessKey: "1".repeat(44),
            mode: "TOTAL",
            selectionByNItem: new Map(),
            reasonCode: "MERCADORIA_NAO_ENTREGUE",
            nowIso: "2026-02-23T12:00:00.000-03:00",
        });

        expect(out.itens.every((item) => item.prod.cfop === "1201")).toBe(true);
    });
});
