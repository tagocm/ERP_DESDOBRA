import { z } from "zod";

export const ParsedNfeXmlHeaderSchema = z.object({
    accessKey: z.string().regex(/^\d{44}$/),
    number: z.string().min(1),
    series: z.string().min(1),
    issuedAt: z.string().min(1),
    model: z.string().default("55"),
    tpAmb: z.enum(["1", "2"]).default("2"),
    emitCnpj: z.string().regex(/^\d{14}$/),
    emitUf: z.string().length(2),
    emitName: z.string().min(1),
    destDocument: z.string().regex(/^\d{11}$|^\d{14}$/),
    destUf: z.string().length(2),
    destName: z.string().min(1),
    totalVnf: z.number().positive(),
});

export type ParsedNfeXmlHeader = z.infer<typeof ParsedNfeXmlHeaderSchema>;

export const ParsedNfeXmlItemSchema = z.object({
    itemNumber: z.number().int().positive(),
    cProd: z.string().min(1),
    xProd: z.string().min(1),
    ncm: z.string().min(1),
    cfop: z.string().regex(/^\d{4}$/),
    uCom: z.string().min(1),
    qCom: z.number().positive(),
    vUnCom: z.number().nonnegative(),
    vProd: z.number().nonnegative(),
    isProduced: z.boolean(),
    imposto: z.object({
        icms: z.object({
            orig: z.enum(["0", "1", "2", "3", "4", "5", "6", "7", "8"]),
            cst: z.string().optional(),
            csosn: z.string().optional(),
            modBC: z.enum(["0", "1", "2", "3"]).optional(),
            vBC: z.number().optional(),
            pICMS: z.number().optional(),
            vICMS: z.number().optional(),
            pRedBC: z.number().optional(),
            pCredSN: z.number().optional(),
            vCredICMSSN: z.number().optional(),
        }).optional(),
        pis: z.object({
            cst: z.string(),
            vBC: z.number().optional(),
            pPIS: z.number().optional(),
            vPIS: z.number().optional(),
        }).optional(),
        cofins: z.object({
            cst: z.string(),
            vBC: z.number().optional(),
            pCOFINS: z.number().optional(),
            vCOFINS: z.number().optional(),
        }).optional(),
        vTotTrib: z.number().optional(),
    }).optional(),
});

export type ParsedNfeXmlItem = z.infer<typeof ParsedNfeXmlItemSchema>;

export const ParsedNfeXmlProtocolSchema = z.object({
    hasProtocol: z.boolean(),
    nProt: z.string().nullable(),
    cStat: z.string().nullable(),
    xMotivo: z.string().nullable(),
    status: z.enum(["AUTHORIZED_WITH_PROTOCOL", "SEM_PROTOCOLO"]),
});

export type ParsedNfeXmlProtocol = z.infer<typeof ParsedNfeXmlProtocolSchema>;

export const ParsedNfeXmlDestinationAddressSchema = z.object({
    xLgr: z.string().nullable().optional(),
    nro: z.string().nullable().optional(),
    xBairro: z.string().nullable().optional(),
    cMun: z.string().regex(/^\d{7}$/).nullable().optional(),
    xMun: z.string().nullable().optional(),
    uf: z.string().length(2).nullable().optional(),
    cep: z.string().regex(/^\d{8}$/).nullable().optional(),
    cPais: z.string().nullable().optional(),
    xPais: z.string().nullable().optional(),
});

export type ParsedNfeXmlDestinationAddress = z.infer<typeof ParsedNfeXmlDestinationAddressSchema>;

export const ParsedNfeXmlDestinationSchema = z.object({
    cpfOuCnpj: z.string().regex(/^\d{11}$|^\d{14}$/),
    xNome: z.string().min(1),
    indIEDest: z.enum(["1", "2", "9"]).optional(),
    ie: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    enderDest: ParsedNfeXmlDestinationAddressSchema.optional(),
});

export type ParsedNfeXmlDestination = z.infer<typeof ParsedNfeXmlDestinationSchema>;

export const ParsedNfeXmlDocumentSchema = z.object({
    header: ParsedNfeXmlHeaderSchema,
    protocol: ParsedNfeXmlProtocolSchema,
    destination: ParsedNfeXmlDestinationSchema,
    items: z.array(ParsedNfeXmlItemSchema).min(1),
});

export type ParsedNfeXmlDocument = z.infer<typeof ParsedNfeXmlDocumentSchema>;

export const LegacyNfeImportResultSchema = z.object({
    fileName: z.string(),
    fileSize: z.number().int().nonnegative(),
    accessKey: z.string().regex(/^\d{44}$/).nullable(),
    result: z.enum(["SUCCESS", "DUPLICATE", "ERROR"]),
    message: z.string(),
    createdNfeId: z.string().uuid().nullable(),
    existingNfeId: z.string().uuid().nullable(),
});

export type LegacyNfeImportResult = z.infer<typeof LegacyNfeImportResultSchema>;

export const LegacyNfeImportSummarySchema = z.object({
    imported: z.number().int().nonnegative(),
    duplicated: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    results: z.array(LegacyNfeImportResultSchema),
});

export type LegacyNfeImportSummary = z.infer<typeof LegacyNfeImportSummarySchema>;
