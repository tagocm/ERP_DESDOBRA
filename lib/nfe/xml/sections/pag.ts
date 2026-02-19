import { NfePag } from "../../domain/types";

export function buildPag(pag: NfePag) {
    return {
        detPag: pag.detPag.map(p => ({
            indPag: p.indPag,
            tPag: p.tPag,
            xPag: p.xPag, // Required if tPag=99
            vPag: p.vPag.toFixed(2),
            card: p.card
                ? {
                    tpIntegra: p.card.tpIntegra,
                    CNPJ: p.card.CNPJ,
                    tBand: p.card.tBand,
                    cAut: p.card.cAut,
                    CNPJReceb: p.card.CNPJReceb,
                    idTermPag: p.card.idTermPag
                }
                : undefined
        })),
        vTroco: pag.vTroco?.toFixed(2)
    };
}
