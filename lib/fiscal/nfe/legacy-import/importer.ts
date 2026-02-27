import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { parseLegacyNfeXml } from "@/lib/fiscal/nfe/legacy-import/parser";
import {
    LegacyNfeImportResult,
    LegacyNfeImportSummary,
    LegacyNfeImportSummarySchema,
    ParsedNfeXmlDocument,
} from "@/lib/fiscal/nfe/legacy-import/schemas";

export type LegacyImportUploadFile = {
    name: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
    text: () => Promise<string>;
};

type ImportDependencies = {
    findExistingEmissionByAccessKey: (companyId: string, accessKey: string) => Promise<string | null>;
    uploadXmlToStorage: (companyId: string, accessKey: string, content: Buffer) => Promise<string>;
    insertEmission: (args: {
        companyId: string;
        userId: string;
        parsed: ParsedNfeXmlDocument;
        rawXml: string;
        storagePath: string;
    }) => Promise<string>;
    insertItems: (args: {
        companyId: string;
        emissionId: string;
        parsed: ParsedNfeXmlDocument;
    }) => Promise<void>;
    insertAuditLog: (args: {
        companyId: string;
        userId: string;
        emissionId: string;
        accessKey: string;
        fileName: string;
    }) => Promise<void>;
    rollbackEmission: (emissionId: string, companyId: string) => Promise<void>;
    rollbackStorage: (storagePath: string) => Promise<void>;
};

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string" && error.trim()) return error;
    return "Erro desconhecido durante importação do XML.";
}

function isXmlFile(file: LegacyImportUploadFile): boolean {
    return file.name.toLowerCase().endsWith(".xml");
}

function buildFileResult(input: Omit<LegacyNfeImportResult, "fileName" | "fileSize"> & { file: LegacyImportUploadFile }): LegacyNfeImportResult {
    return {
        fileName: input.file.name,
        fileSize: input.file.size,
        accessKey: input.accessKey,
        result: input.result,
        message: input.message,
        createdNfeId: input.createdNfeId,
        existingNfeId: input.existingNfeId,
    };
}

export async function importLegacyNfeXmlFiles(args: {
    companyId: string;
    userId: string;
    files: LegacyImportUploadFile[];
    dependencies: ImportDependencies;
}): Promise<LegacyNfeImportSummary> {
    const results: LegacyNfeImportResult[] = [];

    for (const file of args.files) {
        if (!isXmlFile(file)) {
            results.push(
                buildFileResult({
                    file,
                    accessKey: null,
                    result: "ERROR",
                    message: "Arquivo inválido. Envie apenas arquivos .xml.",
                    createdNfeId: null,
                    existingNfeId: null,
                }),
            );
            continue;
        }

        let createdEmissionId: string | null = null;
        let uploadedPath: string | null = null;
        let parsed: ParsedNfeXmlDocument | null = null;

        try {
            const rawXml = await file.text();
            parsed = parseLegacyNfeXml(rawXml);

            const existingEmissionId = await args.dependencies.findExistingEmissionByAccessKey(args.companyId, parsed.header.accessKey);
            if (existingEmissionId) {
                results.push(
                    buildFileResult({
                        file,
                        accessKey: parsed.header.accessKey,
                        result: "DUPLICATE",
                        message: "NF-e já importada para esta empresa.",
                        createdNfeId: null,
                        existingNfeId: existingEmissionId,
                    }),
                );
                continue;
            }

            const binary = Buffer.from(await file.arrayBuffer());
            uploadedPath = await args.dependencies.uploadXmlToStorage(args.companyId, parsed.header.accessKey, binary);

            createdEmissionId = await args.dependencies.insertEmission({
                companyId: args.companyId,
                userId: args.userId,
                parsed,
                rawXml,
                storagePath: uploadedPath,
            });

            await args.dependencies.insertItems({
                companyId: args.companyId,
                emissionId: createdEmissionId,
                parsed,
            });

            await args.dependencies.insertAuditLog({
                companyId: args.companyId,
                userId: args.userId,
                emissionId: createdEmissionId,
                accessKey: parsed.header.accessKey,
                fileName: file.name,
            });

            results.push(
                buildFileResult({
                    file,
                    accessKey: parsed.header.accessKey,
                    result: "SUCCESS",
                    message: "XML legado importado com sucesso.",
                    createdNfeId: createdEmissionId,
                    existingNfeId: null,
                }),
            );
        } catch (error: unknown) {
            const message = toErrorMessage(error);

            if (createdEmissionId) {
                await args.dependencies.rollbackEmission(createdEmissionId, args.companyId);
            }
            if (uploadedPath) {
                await args.dependencies.rollbackStorage(uploadedPath);
            }

            results.push(
                buildFileResult({
                    file,
                    accessKey: parsed?.header.accessKey ?? null,
                    result: "ERROR",
                    message,
                    createdNfeId: null,
                    existingNfeId: null,
                }),
            );
        }
    }

    const summary: LegacyNfeImportSummary = {
        imported: results.filter((result) => result.result === "SUCCESS").length,
        duplicated: results.filter((result) => result.result === "DUPLICATE").length,
        errors: results.filter((result) => result.result === "ERROR").length,
        results,
    };

    return LegacyNfeImportSummarySchema.parse(summary);
}

function createTypedAdminClient(): SupabaseClient<Database> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Variáveis do Supabase ausentes para importação de XML legado.");
    }

    return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function mapPostgrestInsertError(error: { code: string | null; message: string }, accessKey: string): Error {
    if (error.code === "23505") {
        return new Error(`NF-e já importada para esta empresa (chave ${accessKey}).`);
    }
    return new Error(error.message);
}

export function createLegacyImportDependencies(): ImportDependencies {
    const admin = createTypedAdminClient();

    return {
        async findExistingEmissionByAccessKey(companyId, accessKey) {
            const { data, error } = await admin
                .from("nfe_emissions")
                .select("id")
                .eq("company_id", companyId)
                .eq("access_key", accessKey)
                .maybeSingle();

            if (error) throw new Error(`Falha ao validar duplicidade: ${error.message}`);
            return data?.id ?? null;
        },

        async uploadXmlToStorage(companyId, accessKey, content) {
            const path = `companies/${companyId}/nfe/legacy/${accessKey}.xml`;
            const { error } = await admin.storage
                .from("company-assets")
                .upload(path, content, {
                    contentType: "application/xml",
                    upsert: true,
                });

            if (error) throw new Error(`Falha ao enviar XML para storage: ${error.message}`);
            return path;
        },

        async insertEmission({ companyId, userId, parsed, rawXml, storagePath }) {
            const { data, error } = await admin
                .from("nfe_emissions")
                .insert({
                    company_id: companyId,
                    sales_document_id: null,
                    access_key: parsed.header.accessKey,
                    numero: parsed.header.number,
                    serie: parsed.header.series,
                    modelo: parsed.header.model,
                    status: "authorized",
                    tp_amb: parsed.header.tpAmb,
                    uf: parsed.header.emitUf,
                    source_system: "LEGACY_IMPORT",
                    is_read_only: true,
                    legacy_protocol_status: parsed.protocol.status,
                    xml_signed: rawXml,
                    xml_nfe_proc: parsed.protocol.hasProtocol ? rawXml : null,
                    xml_storage_path: storagePath,
                    emit_cnpj: parsed.header.emitCnpj,
                    emit_uf: parsed.header.emitUf,
                    dest_document: parsed.header.destDocument,
                    dest_uf: parsed.header.destUf,
                    total_vnf: parsed.header.totalVnf,
                    authorized_at: parsed.header.issuedAt,
                    imported_at: new Date().toISOString(),
                    imported_by: userId,
                    c_stat: parsed.protocol.cStat ?? "100",
                    x_motivo: parsed.protocol.xMotivo ?? "Autorizada via importação legada",
                    n_prot: parsed.protocol.nProt,
                })
                .select("id")
                .single();

            if (error) throw mapPostgrestInsertError({ code: error.code, message: error.message }, parsed.header.accessKey);
            return data.id;
        },

        async insertItems({ companyId, emissionId, parsed }) {
            const rows = parsed.items.map((item) => ({
                company_id: companyId,
                nfe_emission_id: emissionId,
                item_number: item.itemNumber,
                cprod: item.cProd,
                xprod: item.xProd,
                ncm: item.ncm,
                cfop: item.cfop,
                ucom: item.uCom,
                qcom: item.qCom,
                vuncom: item.vUnCom,
                vprod: item.vProd,
                is_produced: item.isProduced,
            }));

            const { error } = await admin.from("nfe_legacy_import_items").insert(rows);
            if (error) throw new Error(`Falha ao gravar itens importados: ${error.message}`);
        },

        async insertAuditLog({ companyId, userId, emissionId, accessKey, fileName }) {
            const { error } = await admin.from("audit_logs").insert({
                company_id: companyId,
                user_id: userId,
                action: "NFE_LEGACY_XML_IMPORTED",
                entity: "nfe_emissions",
                entity_type: "nfe_emissions",
                entity_id: emissionId,
                details: {
                    source: "LEGACY_IMPORT",
                    access_key: accessKey,
                    file_name: fileName,
                },
            });

            if (error) throw new Error(`Falha ao registrar auditoria da importação: ${error.message}`);
        },

        async rollbackEmission(emissionId, companyId) {
            await admin
                .from("nfe_emissions")
                .delete()
                .eq("id", emissionId)
                .eq("company_id", companyId);
        },

        async rollbackStorage(storagePath) {
            await admin.storage.from("company-assets").remove([storagePath]);
        },
    };
}
