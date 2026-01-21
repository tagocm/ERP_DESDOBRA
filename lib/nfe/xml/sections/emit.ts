import { NfeEmit } from "../../domain/types";

export function buildEmit(emit: NfeEmit) {
    const res: any = {
        CNPJ: emit.cnpj,
        xNome: emit.xNome,
    };
    if (emit.xFant) res.xFant = emit.xFant;

    res.enderEmit = {
        xLgr: emit.enderEmit.xLgr,
        nro: emit.enderEmit.nro,
        xBairro: emit.enderEmit.xBairro,
        cMun: emit.enderEmit.cMun,
        xMun: emit.enderEmit.xMun,
        UF: emit.enderEmit.uf,
        CEP: emit.enderEmit.cep,
        cPais: "1058",
        xPais: "BRASIL",
    };
    if (emit.enderEmit.fone) res.enderEmit.fone = emit.enderEmit.fone;

    res.IE = emit.ie;
    res.CRT = emit.crt;

    return res;
}
