import { NfeItem, NfeImposto } from "../../domain/types";

function formatDecimal(val: number, decimals: number): string {
    return val.toFixed(decimals);
}

function buildImposto(imposto: NfeImposto) {
    const res: any = {};

    // ICMS Simples exemplo, expandir conforme necessidade
    if (imposto.icms) {
        if (imposto.icms.csosn) { // Simples Nacional
            res.ICMS = {
                ICMSSN102: {
                    orig: imposto.icms.orig,
                    CSOSN: imposto.icms.csosn
                }
            };
        } else { // Normal
            const cst = imposto.icms.cst || "00";
            const icmsBase = {
                orig: imposto.icms.orig,
                CST: cst,
                modBC: imposto.icms.modBC || "3",
                vBC: formatDecimal(imposto.icms.vBC || 0, 2),
                pICMS: formatDecimal(imposto.icms.pICMS || 0, 2),
                vICMS: formatDecimal(imposto.icms.vICMS || 0, 2),
            };

            if (cst === "00") {
                res.ICMS = {
                    ICMS00: icmsBase
                };
            } else if (cst === "20") {
                res.ICMS = {
                    ICMS20: {
                        orig: imposto.icms.orig,
                        CST: cst,
                        modBC: imposto.icms.modBC || "3",
                        pRedBC: formatDecimal(imposto.icms.pRedBC ?? 0, 2),
                        vBC: formatDecimal(imposto.icms.vBC || 0, 2),
                        pICMS: formatDecimal(imposto.icms.pICMS || 0, 2),
                        vICMS: formatDecimal(imposto.icms.vICMS || 0, 2),
                    }
                };
            } else if (["40", "41", "50"].includes(cst)) {
                res.ICMS = {
                    ICMS40: {
                        orig: imposto.icms.orig,
                        CST: cst,
                    }
                };
            } else if (cst === "90") {
                res.ICMS = {
                    ICMS90: {
                        ...icmsBase,
                        ...(imposto.icms.pRedBC !== undefined
                            ? { pRedBC: formatDecimal(imposto.icms.pRedBC, 2) }
                            : {}),
                    }
                };
            } else {
                throw new Error(`CST ICMS '${cst}' não suportado no XML da NF-e`);
            }
        }
    }

    if (imposto.pis) {
        const { cst, vBC, pPIS, vPIS } = imposto.pis;
        if (["01", "02"].includes(cst)) {
            res.PIS = {
                PISAliq: {
                    CST: cst,
                    vBC: formatDecimal(vBC || 0, 2),
                    pPIS: formatDecimal(pPIS || 0, 2),
                    vPIS: formatDecimal(vPIS || 0, 2)
                }
            };
        } else if (["04", "05", "06", "07", "08", "09"].includes(cst)) {
            res.PIS = {
                PISNT: {
                    CST: cst
                }
            };
        } else {
            // 49..99
            res.PIS = {
                PISOutr: {
                    CST: cst,
                    vBC: formatDecimal(vBC || 0, 2),
                    pPIS: formatDecimal(pPIS || 0, 2),
                    vPIS: formatDecimal(vPIS || 0, 2)
                }
            };
        }
    }

    if (imposto.cofins) {
        const { cst, vBC, pCOFINS, vCOFINS } = imposto.cofins;
        if (["01", "02"].includes(cst)) {
            res.COFINS = {
                COFINSAliq: {
                    CST: cst,
                    vBC: formatDecimal(vBC || 0, 2),
                    pCOFINS: formatDecimal(pCOFINS || 0, 2),
                    vCOFINS: formatDecimal(vCOFINS || 0, 2)
                }
            };
        } else if (["04", "05", "06", "07", "08", "09"].includes(cst)) {
            res.COFINS = {
                COFINSNT: {
                    CST: cst
                }
            };
        } else {
            // 49..99
            res.COFINS = {
                COFINSOutr: {
                    CST: cst,
                    vBC: formatDecimal(vBC || 0, 2),
                    pCOFINS: formatDecimal(pCOFINS || 0, 2),
                    vCOFINS: formatDecimal(vCOFINS || 0, 2)
                }
            };
        }
    }

    return res;
}

export function buildDet(item: NfeItem) {
    const prod: any = {
        cProd: item.prod.cProd,
        cEAN: item.prod.cean || "SEM GTIN",
        xProd: item.prod.xProd,
        NCM: item.prod.ncm,
        ...(item.prod.cest ? { CEST: item.prod.cest } : {}),
        ...(item.prod.cBenef ? { cBenef: item.prod.cBenef } : {}),
        CFOP: item.prod.cfop,
        uCom: item.prod.uCom,
        qCom: formatDecimal(item.prod.qCom, 4),
        vUnCom: formatDecimal(item.prod.vUnCom, 4),
        vProd: formatDecimal(item.prod.vProd, 2),
        cEANTrib: item.prod.ceanTrib || "SEM GTIN",
        uTrib: item.prod.uTrib,
        qTrib: formatDecimal(item.prod.qTrib, 4),
        vUnTrib: formatDecimal(item.prod.vUnTrib, 4),
        indTot: "1"
    };

    return {
        "@_nItem": item.nItem,
        prod,
        imposto: buildImposto(item.imposto)
    };
}
