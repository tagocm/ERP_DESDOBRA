export interface NfeDraft {
    ide: NfeIde;
    emit: NfeEmit;
    dest: NfeDest;
    itens: NfeItem[];
    transp?: NfeTransp;
    pag: NfePag;
    infAdic?: NfeInfAdic;
}

export interface NfeIde {
    cUF: string; // "35", etc.
    natOp: string;
    mod: "55";
    serie: string;
    nNF: string;
    dhEmi: string; // ISO 8601
    tpNF: "0" | "1"; // 0-entrada, 1-saida
    idDest: "1" | "2" | "3"; // 1-interno, 2-interestadual, 3-exterior
    cMunFG: string;
    tpImp: "1" | "2" | "3" | "4" | "5";
    tpEmis: "1" | "9"; // 1-Normal
    tpAmb: "1" | "2"; // 1-Produção, 2-Homologação
    finNFe: "1" | "2" | "3" | "4"; // 1-Normal, 2-Comp, 3-Ajuste, 4-Devol
    indFinal: "0" | "1"; // 0-Não, 1-Consumidor final
    indPres: "0" | "1" | "2" | "3" | "4" | "9";
    procEmi: "0" | "1" | "2" | "3"; // 0-app contribuinte
    verProc: string;
    chNFe?: string; // 44 digits, optional in draft
    cNF?: string; // Código Numérico
    cDV?: string; // Dígito Verificador
}

export interface NfeEmit {
    cnpj: string;
    xNome: string;
    xFant?: string;
    ie: string;
    crt: "1" | "2" | "3"; // 1-Simples, 3-Normal
    enderEmit: NfeEndereco;
}

export interface NfeDest {
    cpfOuCnpj: string;
    xNome: string;
    indIEDest: "1" | "2" | "9";
    ie?: string;
    enderDest: NfeEndereco;
}

export interface NfeEndereco {
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun: string;
    xMun: string;
    uf: string;
    cep: string;
    cPais?: string; // Default 1058
    xPais?: string; // Default Brasil
    fone?: string;
}

export interface NfeItem {
    nItem: number;
    prod: NfeProd;
    imposto: NfeImposto;
    vDesc?: number;
    vFrete?: number;
    vOutro?: number;
    vSeg?: number;
}

export interface NfeProd {
    cProd: string;
    xProd: string;
    ncm: string;
    cest?: string;
    cfop: string;
    uCom: string;
    qCom: number;
    vUnCom: number;
    vProd: number;
    cean: string;
    ceanTrib: string;
    uTrib: string;
    qTrib: number;
    vUnTrib: number;
    infAdProd?: string; // Additional product info (e.g., equivalence overflow)
}

export interface NfeImposto {
    icms?: {
        orig: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
        cst?: string; // Para CRT=3
        csosn?: string; // Para CRT=1
        modBC?: "0" | "1" | "2" | "3";
        vBC?: number;
        pICMS?: number;
        vICMS?: number;
        pRedBC?: number;
        // Simples Nacional Fields
        pCredSN?: number;
        vCredICMSSN?: number;
    };
    pis?: {
        cst: string;
        vBC?: number;
        pPIS?: number;
        vPIS?: number;
    };
    cofins?: {
        cst: string;
        vBC?: number;
        pCOFINS?: number;
        vCOFINS?: number;
    };
    vTotTrib?: number;
}

export interface NfeTransp {
    modFrete: "0" | "1" | "2" | "3" | "4" | "9";
    vol?: {
        qVol?: number;
        esp?: string;
        marca?: string;
        nVol?: string;
        pesoL?: number;
        pesoB?: number;
    }[];
}

export interface NfePag {
    detPag: Array<{
        indPag?: "0" | "1"; // 0-Vista, 1-Prazo
        tPag: string; // 01-Dinheiro, 03-Cartão...
        vPag: number;
        xPag?: string; // Descrição para tPag=99
    }>;
    vTroco?: number;
}

export interface NfeInfAdic {
    infCpl?: string;
    infAdFisco?: string;
}
