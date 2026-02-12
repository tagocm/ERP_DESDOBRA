import { z } from "zod";
import { NfeDraft, NfeItem } from "./types";
import { ValidationIssue } from "./errors";

// Helper regex
const CNPJ_REGEX = /^\d{14}$/;
const CPF_REGEX = /^\d{11}$/;
const UF_REGEX = /^[A-Z]{2}$/;

const nfeSchema = z.object({
    ide: z.object({
        cUF: z.string().length(2),
        natOp: z.string().min(1),
        mod: z.literal("55"),
        serie: z.string().min(1),
        nNF: z.string().min(1),
        dhEmi: z.string().datetime(),
        tpNF: z.enum(["0", "1"]),
        idDest: z.enum(["1", "2", "3"]),
        cMunFG: z.string().length(7),
        tpImp: z.enum(["1", "2", "3", "4", "5"]),
        tpEmis: z.enum(["1", "9"]),
        tpAmb: z.enum(["1", "2"]),
        finNFe: z.enum(["1", "2", "3", "4"]),
        indFinal: z.enum(["0", "1"]),
        indPres: z.enum(["0", "1", "2", "3", "4", "9"]),
        procEmi: z.enum(["0", "1", "2", "3"]),
        verProc: z.string().min(1),
        chNFe: z.string().regex(/^\d{44}$/, "Chave deve ter 44 dígitos numéricos").optional(),
    }),
    emit: z.object({
        cnpj: z.string().regex(CNPJ_REGEX, "CNPJ deve ter 14 dígitos numéricos"),
        xNome: z.string().min(2).max(60),
        ie: z.string().min(2).max(14),
        crt: z.enum(["1", "2", "3"]),
        enderEmit: z.object({
            xLgr: z.string().min(2).max(60),
            nro: z.string().min(1).max(60),
            xBairro: z.string().min(2).max(60),
            cMun: z.string().length(7),
            xMun: z.string().min(2).max(60),
            uf: z.string().regex(UF_REGEX),
            cep: z.string().length(8),
        })
    }),
    dest: z.object({
        cpfOuCnpj: z.string().refine((val) => val.length === 11 || val.length === 14, "CPF/CNPJ inválido"),
        xNome: z.string().min(2).max(60),
        indIEDest: z.enum(["1", "2", "9"]),
        ie: z.string().optional(),
        enderDest: z.object({
            xLgr: z.string().min(2).max(60),
            nro: z.string().min(1).max(60),
            xBairro: z.string().min(2).max(60),
            cMun: z.string().length(7),
            xMun: z.string().min(2).max(60),
            uf: z.string().regex(UF_REGEX),
            cep: z.string().length(8),
        })
    }),
    itens: z.array(z.object({
        nItem: z.number().int().positive(),
        prod: z.object({
            cProd: z.string().min(1).max(60),
            xProd: z.string().min(1).max(120),
            ncm: z.string().length(8),
            cfop: z.string().length(4),
            uCom: z.string().min(1).max(6),
            qCom: z.number().positive(),
            vUnCom: z.number().positive(),
            vProd: z.number().nonnegative(),
            uTrib: z.string().min(1).max(6),
            qTrib: z.number().positive(),
            vUnTrib: z.number().positive(),
        })
    })).min(1, "A nota deve ter pelo menos um item"),
    transp: z.object({
        modFrete: z.enum(["0", "1", "2", "3", "4", "9"])
    }).optional(),
    cobr: z.object({
        fat: z.object({
            nFat: z.string().optional(),
            vOrig: z.number().nonnegative(),
            vDesc: z.number().nonnegative().optional(),
            vLiq: z.number().nonnegative()
        }).optional(),
        dup: z.array(z.object({
            nDup: z.string().min(1),
            dVenc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            vDup: z.number().nonnegative()
        })).optional()
    }).optional(),
    pag: z.object({
        detPag: z.array(z.object({
            tPag: z.string().length(2),
            vPag: z.number().nonnegative()
        })).min(1)
    })
});

export function validateNfeDraft(draft: NfeDraft): ValidationIssue[] {
    const result = nfeSchema.safeParse(draft);
    if (result.success) return [];

    return result.error.issues.map(err => ({
        path: err.path.join("."),
        message: err.message,
        code: "DADOS"
    }));
}

export function validateItemTotals(items: NfeItem[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    items.forEach((item, index) => {
        if (!item || !item.prod) return;
        const calculated = item.prod.qCom * item.prod.vUnCom;
        const diff = Math.abs(calculated - item.prod.vProd);

        // Tolerância de 1 centavo para arredondamento
        if (diff > 0.01) {
            issues.push({
                path: `itens[${index}].prod.vProd`,
                message: `Valor do produto (vProd: ${item.prod.vProd}) diverge do calculado (qCom * vUnCom: ${calculated.toFixed(2)})`,
                code: "DADOS"
            });
        }
    });


    return issues;
}

export function validateImpostoRules(items: NfeItem[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    items.forEach((item, index) => {
        if (!item || !item.imposto) return;

        // PIS Validation
        if (item.imposto.pis) {
            const { cst, vBC, pPIS } = item.imposto.pis;
            if (["01", "02"].includes(cst)) {
                if (vBC === undefined) {
                    issues.push({ path: `itens[${index}].imposto.pis.vBC`, message: "PIS CST 01/02 exige vBC", code: "DADOS" });
                }
                if (pPIS === undefined) {
                    issues.push({ path: `itens[${index}].imposto.pis.pPIS`, message: "PIS CST 01/02 exige pPIS", code: "DADOS" });
                }
            }
            if (cst === "03") {
                issues.push({ path: `itens[${index}].imposto.pis.cst`, message: "CST 03 (PIS) não suportado neste momento", code: "DADOS" });
            }
        }

        // COFINS Validation
        if (item.imposto.cofins) {
            const { cst, vBC, pCOFINS } = item.imposto.cofins;
            if (["01", "02"].includes(cst)) {
                if (vBC === undefined) {
                    issues.push({ path: `itens[${index}].imposto.cofins.vBC`, message: "COFINS CST 01/02 exige vBC", code: "DADOS" });
                }
                if (pCOFINS === undefined) {
                    issues.push({ path: `itens[${index}].imposto.cofins.pCOFINS`, message: "COFINS CST 01/02 exige pCOFINS", code: "DADOS" });
                }
            }
            if (cst === "03") {
                issues.push({ path: `itens[${index}].imposto.cofins.cst`, message: "CST 03 (COFINS) não suportado neste momento", code: "DADOS" });
            }
        }
    });

    return issues;
}
