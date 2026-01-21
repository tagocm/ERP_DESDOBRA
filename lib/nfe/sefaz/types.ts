export interface SefazEnvConfig {
    xmlNfeAssinado: string;
    idLote: string;
    indSinc?: "0" | "1"; // 0=Async (default), 1=Sync
    tpAmb: "1" | "2"; // 1=Prod, 2=Homolog
    uf: string;
}

export interface SefazCertConfig {
    pfxBase64: string;
    pfxPassword: string;
}

export interface SefazResponse {
    step: "enviarLote" | "consultarRecibo" | "consultarProtocolo";
    httpStatus: number;
    cStat: string;
    xMotivo: string;
    nRec?: string; // Recibo do lote
    dhRecbto?: string;
    protNFeXml?: string; // XML do protocolo quando autorizado
    rawXml: string; // XML bruto de resposta
}

export interface SefazRequestOptions {
    debug?: boolean;
    debugDir?: string; // default: "/tmp/desdobra-sefaz"
    debugMaxBodyChars?: number; // default: 5000
    timeoutMs?: number; // default: 30000
    caPem?: string | Buffer; // Custom CA Bundle
}
