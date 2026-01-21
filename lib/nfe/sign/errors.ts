export class NfeSignError extends Error {
    public code: "CERT" | "XML" | "DADOS";
    public details?: any;

    constructor(message: string, code: "CERT" | "XML" | "DADOS", details?: any) {
        super(message);
        this.name = "NfeSignError";
        this.code = code;
        this.details = details;
    }
}
