import { Totals } from "../../domain/calculators";

function fmt(n: number) { return n.toFixed(2); }

export function buildTotal(t: Totals) {
    return {
        ICMSTot: {
            vBC: fmt(t.vBC),
            vICMS: fmt(t.vICMS),
            vICMSDeson: fmt(t.vICMSDeson),
            vFCP: fmt(t.vFCP),
            vBCST: fmt(t.vBCST),
            vST: fmt(t.vST),
            vFCPST: fmt(t.vFCPST),
            vFCPSTRet: fmt(t.vFCPSTRet),
            vProd: fmt(t.vProd),
            vFrete: fmt(t.vFrete),
            vSeg: fmt(t.vSeg),
            vDesc: fmt(t.vDesc),
            vII: fmt(t.vII),
            vIPI: fmt(t.vIPI),
            vIPIDevol: fmt(t.vIPIDevol),
            vPIS: fmt(t.vPIS),
            vCOFINS: fmt(t.vCOFINS),
            vOutro: fmt(t.vOutro),
            vNF: fmt(t.vNF),
        }
    };
}
