import { describe, expect, it } from "vitest";
import { buildInboundReversalNfe } from "../buildInboundReversalNfe";

function sampleOutboundDraft() {
    return {
        ide: {
            cUF: "35",
            natOp: "VENDA",
            mod: "55" as const,
            serie: "1",
            nNF: "10",
            dhEmi: "2026-02-23T10:00:00.000-03:00",
            tpNF: "1" as const,
            idDest: "1" as const,
            cMunFG: "3550308",
            tpImp: "1" as const,
            tpEmis: "1" as const,
            tpAmb: "2" as const,
            finNFe: "1" as const,
            indFinal: "1" as const,
            indPres: "1" as const,
            procEmi: "0" as const,
            verProc: "ERP",
            cNF: "12345678",
            chNFe: "3".repeat(44),
        },
        emit: {
            cnpj: "03645616000108",
            xNome: "EMPRESA TESTE",
            ie: "123",
            crt: "1" as const,
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
            xNome: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
            indIEDest: "9" as const,
            enderDest: {
                xLgr: "Rua B",
                nro: "2",
                xBairro: "Centro",
                cMun: "3550308",
                xMun: "SAO PAULO",
                uf: "SP",
                cep: "01001000",
            },
        },
        itens: [
            {
                nItem: 1,
                prod: {
                    cProd: "SKU1",
                    xProd: "Produto 1",
                    ncm: "01010101",
                    cfop: "5102",
                    uCom: "UN",
                    qCom: 10,
                    vUnCom: 5,
                    vProd: 50,
                    cean: "SEM GTIN",
                    ceanTrib: "SEM GTIN",
                    uTrib: "UN",
                    qTrib: 10,
                    vUnTrib: 5,
                },
                imposto: {
                    vTotTrib: 0,
                    pis: { cst: "07", vBC: 0, vPIS: 0 },
                    cofins: { cst: "07", vBC: 0, vCOFINS: 0 },
                },
            },
            {
                nItem: 2,
                prod: {
                    cProd: "SKU2",
                    xProd: "Produto 2",
                    ncm: "01010101",
                    cfop: "5102",
                    uCom: "UN",
                    qCom: 4,
                    vUnCom: 3,
                    vProd: 12,
                    cean: "SEM GTIN",
                    ceanTrib: "SEM GTIN",
                    uTrib: "UN",
                    qTrib: 4,
                    vUnTrib: 3,
                },
                imposto: {
                    vTotTrib: 0,
                    pis: { cst: "07", vBC: 0, vPIS: 0 },
                    cofins: { cst: "07", vBC: 0, vCOFINS: 0 },
                },
            },
        ],
        pag: {
            detPag: [{ tPag: "15", vPag: 62 }],
        },
    };
}

describe("buildInboundReversalNfe", () => {
    it("builds total reversal with finNFe=4, NFref and sem pagamento", () => {
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
        expect(out.pag.detPag[0].tPag).toBe("90");
        expect(out.pag.detPag[0].vPag).toBe(0);
        expect(out.itens).toHaveLength(2);
        expect(out.itens[0].prod.cfop).toBe("1202"); // inferred from outbound CFOP 5102
    });

    it("infers produced items from outbound CFOP 5101 and uses 1201", () => {
        const draft = sampleOutboundDraft();
        draft.itens[0].prod.cfop = "5101";

        const out = buildInboundReversalNfe({
            outboundDraft: draft,
            outboundAccessKey: "1".repeat(44),
            mode: "TOTAL",
            selectionByNItem: new Map(),
            reasonCode: "MERCADORIA_NAO_ENTREGUE",
            nowIso: "2026-02-23T12:00:00.000-03:00",
        });

        expect(out.itens[0].prod.cfop).toBe("1201");
    });

    it("builds partial reversal with proportional qty and cfop by isProduced", () => {
        const draft = sampleOutboundDraft();
        const sel = new Map<number, { qty: number; isProduced: boolean }>([
            [1, { qty: 2, isProduced: true }],
            [2, { qty: 1, isProduced: false }],
        ]);

        const out = buildInboundReversalNfe({
            outboundDraft: draft,
            outboundAccessKey: "2".repeat(44),
            mode: "PARCIAL",
            selectionByNItem: sel,
            reasonCode: "OUTROS",
            reasonOther: "Teste",
            nowIso: "2026-02-23T12:00:00.000-03:00",
        });

        expect(out.itens).toHaveLength(2);
        expect(out.itens[0].prod.qCom).toBe(2);
        expect(out.itens[0].prod.vProd).toBe(10); // 2 * 5
        expect(out.itens[0].prod.cfop).toBe("1201");
        expect(out.itens[1].prod.qCom).toBe(1);
        expect(out.itens[1].prod.vProd).toBe(3);
        expect(out.itens[1].prod.cfop).toBe("1202");
        expect(out.infAdic?.infCpl).toContain("Estorno parcial");
    });
});
