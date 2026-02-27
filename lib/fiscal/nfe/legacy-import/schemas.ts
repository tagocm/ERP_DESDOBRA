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

export const ParsedNfeXmlDocumentSchema = z.object({
    header: ParsedNfeXmlHeaderSchema,
    protocol: ParsedNfeXmlProtocolSchema,
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
