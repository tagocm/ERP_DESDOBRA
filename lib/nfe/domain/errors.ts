export interface ValidationIssue {
    path: string;
    message: string;
    code: "DADOS" | "PARAMETRIZACAO";
}

export class NfeBuildError extends Error {
    public issues: ValidationIssue[];

    constructor(issues: ValidationIssue[]) {
        super("Falha na geração do XML da NF-e");
        this.name = "NfeBuildError";
        this.issues = issues;
    }
}
