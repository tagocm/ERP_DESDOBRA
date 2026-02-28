import { NfeDest } from "../../domain/types";

interface NfeDestXmlView {
    CNPJ?: string;
    CPF?: string;
    xNome: string;
    enderDest: {
        xLgr: string;
        nro: string;
        xBairro: string;
        cMun: string;
        xMun: string;
        UF: string;
        CEP: string;
        cPais: string;
        xPais: string;
        fone?: string;
    };
    indIEDest: NfeDest["indIEDest"];
    IE?: string;
    email?: string;
}

export function buildDest(dest: NfeDest) {
    const documentNode = dest.cpfOuCnpj.length === 14
        ? { CNPJ: dest.cpfOuCnpj }
        : { CPF: dest.cpfOuCnpj };

    const res: NfeDestXmlView = {
        ...documentNode,
        xNome: dest.xNome,
        enderDest: {
            xLgr: dest.enderDest.xLgr,
            nro: dest.enderDest.nro,
            xBairro: dest.enderDest.xBairro,
            cMun: dest.enderDest.cMun,
            xMun: dest.enderDest.xMun,
            UF: dest.enderDest.uf,
            CEP: dest.enderDest.cep,
            cPais: "1058",
            xPais: "BRASIL",
        },
        indIEDest: dest.indIEDest,
    };

    if (dest.enderDest.fone) res.enderDest.fone = dest.enderDest.fone;
    if (dest.ie) res.IE = dest.ie;
    if (dest.email) res.email = dest.email;

    return res;
}
