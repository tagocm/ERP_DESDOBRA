import { NfePag } from "../../domain/types";

export function buildPag(pag: NfePag) {
    return {
        detPag: pag.detPag.map(p => ({
            indPag: p.indPag,
            tPag: p.tPag,
            vPag: p.vPag.toFixed(2),
            xPag: p.xPag // Required if tPag=99
        })),
        vTroco: pag.vTroco?.toFixed(2)
    };
}
