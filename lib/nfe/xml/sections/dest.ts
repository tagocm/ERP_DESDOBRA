import { NfeDest } from "../../domain/types";

export function buildDest(dest: NfeDest) {
    const res: any = {};

    if (dest.cpfOuCnpj.length === 14) res.CNPJ = dest.cpfOuCnpj;
    else res.CPF = dest.cpfOuCnpj;

    res.xNome = dest.xNome;

    res.enderDest = {
        xLgr: dest.enderDest.xLgr,
        nro: dest.enderDest.nro,
        xBairro: dest.enderDest.xBairro,
        cMun: dest.enderDest.cMun,
        xMun: dest.enderDest.xMun,
        UF: dest.enderDest.uf,
        CEP: dest.enderDest.cep,
        cPais: "1058",
        xPais: "BRASIL",
    };
    if (dest.enderDest.fone) res.enderDest.fone = dest.enderDest.fone;

    res.indIEDest = dest.indIEDest;
    if (dest.ie) res.IE = dest.ie;

    return res;
}
