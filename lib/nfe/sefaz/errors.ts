export class NfeSefazError extends Error {
    public code: "ENDPOINT" | "CERT" | "SOAP" | "PARSE" | "SEFAZ" | "HTTP" | "TIMEOUT" | "MAX_ATTEMPTS";
    public details?: any;

    constructor(message: string, code: "ENDPOINT" | "CERT" | "SOAP" | "PARSE" | "SEFAZ" | "HTTP" | "TIMEOUT" | "MAX_ATTEMPTS", details?: any) {
        super(message);
        this.name = "NfeSefazError";
        this.code = code;
        this.details = details;
    }
}
