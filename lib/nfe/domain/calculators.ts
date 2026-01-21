import { NfeDraft } from "./types";

export interface Totals {
    vBC: number;
    vICMS: number;
    vICMSDeson: number;
    vFCP: number;
    vBCST: number;
    vST: number;
    vFCPST: number;
    vFCPSTRet: number;
    vProd: number;
    vFrete: number;
    vSeg: number;
    vDesc: number;
    vII: number;
    vIPI: number;
    vIPIDevol: number;
    vPIS: number;
    vCOFINS: number;
    vOutro: number;
    vNF: number;
    vTotTrib: number;
}

export function calcIcmsTot(draft: NfeDraft): Totals {
    const totals: Totals = {
        vBC: 0, vICMS: 0, vICMSDeson: 0, vFCP: 0, vBCST: 0, vST: 0, vFCPST: 0, vFCPSTRet: 0,
        vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vII: 0, vIPI: 0, vIPIDevol: 0,
        vPIS: 0, vCOFINS: 0, vOutro: 0, vNF: 0, vTotTrib: 0
    };

    draft.itens.forEach(item => {
        totals.vProd += item.prod.vProd;
        totals.vDesc += item.vDesc || 0;
        totals.vFrete += item.vFrete || 0;
        totals.vSeg += item.vSeg || 0;
        totals.vOutro += item.vOutro || 0;

        // Impostos
        if (item.imposto.icms) {
            totals.vBC += item.imposto.icms.vBC || 0;
            totals.vICMS += item.imposto.icms.vICMS || 0;
        }
        if (item.imposto.pis) {
            totals.vPIS += item.imposto.pis.vPIS || 0;
        }
        if (item.imposto.cofins) {
            totals.vCOFINS += item.imposto.cofins.vCOFINS || 0;
        }
        totals.vTotTrib += item.imposto.vTotTrib || 0;
    });

    // vNF = vProd - vDesc - vICMSDeson + vST + vFrete + vSeg + vOutro + vII + vIPI
    // Simplificado para escopo inicial
    totals.vNF = totals.vProd - totals.vDesc + totals.vFrete + totals.vSeg + totals.vOutro + totals.vST + totals.vIPI;

    return totals;
}
