import { NfeCobr } from "../../domain/types";

export function buildCobr(cobr: NfeCobr) {
    const fat = cobr.fat
        ? {
            nFat: cobr.fat.nFat,
            vOrig: cobr.fat.vOrig.toFixed(2),
            vDesc: cobr.fat.vDesc !== undefined ? cobr.fat.vDesc.toFixed(2) : undefined,
            vLiq: cobr.fat.vLiq.toFixed(2),
        }
        : undefined;

    const dup = cobr.dup?.map((d) => ({
        nDup: d.nDup,
        dVenc: d.dVenc,
        vDup: d.vDup.toFixed(2),
    }));

    return {
        fat,
        dup,
    };
}
