export interface SignNfeResult {
    signedXml: string;
    certInfo: {
        subject: string;
        serial: string;
        notBefore: string;
        notAfter: string;
    };
}

export interface SignNfeParams {
    pfxBase64: string;
    pfxPassword: string;
}
