type ResolveEmissionPayload = {
    emissionId?: string;
    accessKey?: string;
    salesDocumentId?: string;
    nfeNumber?: string | number | null;
    nfeSeries?: string | number | null;
};

type ResolvedEmission = {
    id: string;
    company_id: string;
    sales_document_id: string | null;
    access_key: string;
    status: string;
    n_prot: string | null;
};

const EMISSION_SELECT = "id,company_id,sales_document_id,access_key,status,n_prot";
const LEGACY_SELECT = "id,document_id,nfe_key,nfe_number,nfe_series,status,issued_at,details";

function normalizeAccessKey(input?: string | null): string | null {
    if (!input) return null;
    const digitsOnly = input.replace(/\D/g, "");
    return digitsOnly.length > 0 ? digitsOnly : null;
}

function numberOrNull(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
}

function mapLegacyStatus(status: string | null | undefined): string {
    const value = String(status || "").toLowerCase();
    if (["authorized", "cancelled", "processing", "error", "rejected", "denied"].includes(value)) {
        return value;
    }
    return "authorized";
}
const IBGE_UF_MAP: Record<string, string> = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF"
};

export function getUfFromAccessKey(accessKey: string | null | undefined): string | null {
    if (!accessKey || accessKey.length !== 44) return null;
    const code = accessKey.substring(0, 2);
    return IBGE_UF_MAP[code] || null;
}

function parseLegacyDetails(details: any): any {
    if (!details) return null;
    if (typeof details === "object") return details;
    if (typeof details === "string") {
        try {
            return JSON.parse(details);
        } catch {
            return null;
        }
    }
    return null;
}

function extractLegacyNProt(details: any): string | null {
    const parsed = parseLegacyDetails(details);
    const candidates = [
        parsed?.protNFe?.infProt?.nProt,
        parsed?.retEvento?.infEvento?.nProt,
        parsed?.authorization?.nProt,
        parsed?.nProt,
        parsed?.sefaz?.nProt,
        parsed?.protCons?.nProt,
        parsed?.infProt?.nProt,
    ];
    for (const candidate of candidates) {
        if (candidate && typeof candidate === "string" && candidate.trim()) return candidate.trim();
        if (candidate && typeof candidate === "number") return String(candidate);
    }
    return null;
}

export async function resolveEmissionForFiscalAction(params: {
    admin: any;
    companyIds: string[];
    payload: ResolveEmissionPayload;
}): Promise<ResolvedEmission | null> {
    const { admin, companyIds, payload } = params;
    if (!companyIds.length) return null;

    const companyIdSet = new Set(companyIds);
    const documentCompanyCache = new Map<string, string | null>();

    const getDocumentCompanyId = async (documentId?: string | null): Promise<string | null> => {
        if (!documentId) return null;
        if (documentCompanyCache.has(documentId)) {
            return documentCompanyCache.get(documentId) || null;
        }

        const { data, error } = await admin
            .from("sales_documents")
            .select("id,company_id")
            .eq("id", documentId)
            .maybeSingle();

        if (error) {
            throw new Error(`Falha ao consultar pedido da NF-e: ${error.message}`);
        }

        const companyId = data?.company_id || null;
        documentCompanyCache.set(documentId, companyId);
        return companyId;
    };

    const belongsToAllowedCompany = async (legacyRow: any): Promise<boolean> => {
        const companyId = await getDocumentCompanyId(legacyRow?.document_id || null);
        return !!(companyId && companyIdSet.has(companyId));
    };

    const normalizedAccessKey = normalizeAccessKey(payload.accessKey);
    const possibleKeys = Array.from(
        new Set([normalizedAccessKey, payload.accessKey].filter((value): value is string => Boolean(value)))
    );

    if (payload.emissionId) {
        const byId = await admin
            .from("nfe_emissions")
            .select(EMISSION_SELECT)
            .eq("id", payload.emissionId)
            .in("company_id", companyIds)
            .maybeSingle();

        if (byId.error) {
            throw new Error(`Falha ao consultar emissão por ID: ${byId.error.message}`);
        }
        if (byId.data) return byId.data;
    }

    for (const key of possibleKeys) {
        const byKey = await admin
            .from("nfe_emissions")
            .select(EMISSION_SELECT)
            .eq("access_key", key)
            .in("company_id", companyIds)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (byKey.error) {
            throw new Error(`Falha ao consultar emissão por chave de acesso: ${byKey.error.message}`);
        }
        if (byKey.data) return byKey.data;
    }

    let legacyNfe: any = null;

    for (const key of possibleKeys) {
        const legacyByKey = await admin
            .from("sales_document_nfes")
            .select(LEGACY_SELECT)
            .eq("nfe_key", key)
            .order("issued_at", { ascending: false })
            .limit(30);

        if (legacyByKey.error) {
            throw new Error(`Falha ao consultar legado por chave de acesso: ${legacyByKey.error.message}`);
        }

        for (const row of legacyByKey.data || []) {
            if (await belongsToAllowedCompany(row)) {
                legacyNfe = row;
                break;
            }
        }

        if (legacyNfe) break;
    }

    if (!legacyNfe && payload.salesDocumentId) {
        const documentCompanyId = await getDocumentCompanyId(payload.salesDocumentId);
        if (documentCompanyId && companyIdSet.has(documentCompanyId)) {
            const byDocument = await admin
                .from("sales_document_nfes")
                .select(LEGACY_SELECT)
                .eq("document_id", payload.salesDocumentId)
                .order("issued_at", { ascending: false })
                .limit(30);

            if (byDocument.error) {
                throw new Error(`Falha ao consultar legado por pedido: ${byDocument.error.message}`);
            }

            const candidates = (byDocument.data || []).filter((row: any) => !!row?.nfe_key);
            const targetNumber = numberOrNull(payload.nfeNumber);
            const targetSeries = numberOrNull(payload.nfeSeries);

            legacyNfe =
                candidates.find((row: any) => possibleKeys.some((key) => row?.nfe_key === key)) ||
                candidates.find((row: any) => {
                    if (targetNumber === null) return false;
                    if (Number(row?.nfe_number) !== targetNumber) return false;
                    if (targetSeries !== null && Number(row?.nfe_series) !== targetSeries) return false;
                    return true;
                }) ||
                candidates[0] ||
                null;
        }
    }

    if (!legacyNfe && payload.emissionId) {
        const legacyById = await admin
            .from("sales_document_nfes")
            .select(LEGACY_SELECT)
            .eq("id", payload.emissionId)
            .maybeSingle();

        if (legacyById.error) {
            throw new Error(`Falha ao consultar legado por ID: ${legacyById.error.message}`);
        }

        if (legacyById.data && await belongsToAllowedCompany(legacyById.data)) {
            legacyNfe = legacyById.data;
        }
    }

    if (!legacyNfe?.nfe_key) return null;

    const legacyCompanyId = await getDocumentCompanyId(legacyNfe.document_id);
    if (!legacyCompanyId || !companyIdSet.has(legacyCompanyId)) return null;

    const normalizedLegacyKey = normalizeAccessKey(legacyNfe.nfe_key) || legacyNfe.nfe_key;

    const existingCanonical = await admin
        .from("nfe_emissions")
        .select(EMISSION_SELECT)
        .eq("company_id", legacyCompanyId)
        .eq("access_key", normalizedLegacyKey)
        .maybeSingle();

    if (existingCanonical.error) {
        throw new Error(`Falha ao validar emissão canônica existente: ${existingCanonical.error.message}`);
    }
    if (existingCanonical.data) return existingCanonical.data;

    const { data: companySettings, error: settingsError } = await admin
        .from("company_settings")
        .select("nfe_environment")
        .eq("company_id", legacyCompanyId)
        .maybeSingle();

    if (settingsError) {
        throw new Error(`Falha ao consultar configurações fiscais da empresa: ${settingsError.message}`);
    }


    const tpAmb = companySettings?.nfe_environment === "production" ? "1" : "2";

    // Resolve UF directly from the Access Key (definitive source)
    const uf = getUfFromAccessKey(normalizedLegacyKey) || "SP";

    const backfill = await admin
        .from("nfe_emissions")
        .upsert({
            company_id: legacyCompanyId,
            sales_document_id: legacyNfe.document_id,
            access_key: normalizedLegacyKey,
            numero: String(legacyNfe.nfe_number || 0),
            serie: String(legacyNfe.nfe_series || 1),
            status: mapLegacyStatus(legacyNfe.status),
            tp_amb: tpAmb,
            uf,
            xml_signed: "legacy-backfill",
            n_prot: extractLegacyNProt(legacyNfe.details),
            authorized_at: legacyNfe.issued_at || null,
        }, { onConflict: "company_id,access_key" });

    if (backfill.error) {
        throw new Error(`Falha ao sincronizar NF-e legada para emissão canônica: ${backfill.error.message}`);
    }

    const recovered = await admin
        .from("nfe_emissions")
        .select(EMISSION_SELECT)
        .eq("company_id", legacyCompanyId)
        .eq("access_key", normalizedLegacyKey)
        .maybeSingle();

    if (recovered.error) {
        throw new Error(`Falha ao recuperar emissão canônica após sincronização: ${recovered.error.message}`);
    }

    return recovered.data || null;
}
