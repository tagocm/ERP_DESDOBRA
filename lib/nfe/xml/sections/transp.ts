import { NfeTransp } from "../../domain/types";

export function buildTransp(transp: NfeTransp) {
    return {
        modFrete: transp.modFrete,
        vol: transp.vol ? transp.vol.map(v => ({
            qVol: v.qVol,
            esp: v.esp,
            marca: v.marca,
            nVol: v.nVol,
            pesoL: v.pesoL?.toFixed(3),
            pesoB: v.pesoB?.toFixed(3)
        })) : undefined
    };
}
