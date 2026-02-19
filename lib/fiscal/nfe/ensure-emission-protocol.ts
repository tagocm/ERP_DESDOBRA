import { loadCompanyCertificate } from "@/lib/nfe/sefaz/services/certificateLoader";
import { consultarProtocolo } from "@/lib/nfe/sefaz/services/consultarProtocolo";
import { getUfFromAccessKey } from "@/lib/fiscal/nfe/resolve-emission";

function extractNProtFromXml(xml?: string | null): string | null {
    if (!xml) return null;
    const match = xml.match(/<(?:\w+:)?nProt>\s*([0-9]+)\s*<\/(?:\w+:)?nProt>/i);
    return match?.[1] || null;
}

function extractLegacyNProt(details: unknown): string | null {
    if (!details) return null;

    let parsed: any = null;
    if (typeof details === "object") {
        parsed = details;
    } else if (typeof details === "string") {
        try {
            parsed = JSON.parse(details);
        } catch {
            parsed = null;
        }
    }

    if (!parsed) return null;

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
        if (candidate && typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
        if (candidate && typeof candidate === "number") {
            return String(candidate);
        }
    }

    return null;
}

function extractNProtFromSefazResponse(response: any): string | null {
    const candidates = [
        response?.rawResponse?.protNFe?.infProt?.nProt,
        response?.rawResponse?.infProt?.nProt,
        response?.rawResponse?.nProt,
        response?.nProt,
    ];

    for (const candidate of candidates) {
        if (candidate && typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
        if (candidate && typeof candidate === "number") {
            return String(candidate);
        }
    }

    return extractNProtFromXml(response?.protNFeXml || null);
}

export async function ensureEmissionProtocol(params: {
    admin: any;
    emissionId: string;
    companyId: string;
    accessKey: string;
    existingNProt?: string | null;
}) {
    const { admin, emissionId, companyId, accessKey, existingNProt } = params;
    if (existingNProt) return existingNProt;

    const { data: canonical } = await admin
        .from("nfe_emissions")
        .select("id, company_id, access_key, n_prot, tp_amb, uf, xml_nfe_proc")
        .eq("id", emissionId)
        .eq("company_id", companyId)
        .maybeSingle();

    let recoveredNProt =
        canonical?.n_prot ||
        extractNProtFromXml(canonical?.xml_nfe_proc) ||
        null;

    if (!recoveredNProt) {
        const { data: legacy } = await admin
            .from("sales_document_nfes")
            .select("details")
            .eq("nfe_key", accessKey)
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        recoveredNProt = extractLegacyNProt(legacy?.details) || null;
    }

    if (!recoveredNProt) {
        try {
            let uf = canonical?.uf;
            let tpAmb = canonical?.tp_amb;

            // Resolve tpAmb if missing
            if (!tpAmb) {
                const { data: settings } = await admin
                    .from("company_settings")
                    .select("nfe_environment")
                    .eq("company_id", companyId)
                    .maybeSingle();
                tpAmb = settings?.nfe_environment === "production" ? "1" : "2";
            }

            // Resolve UF if missing (use the new robust decoder)
            if (!uf) {
                uf = getUfFromAccessKey(accessKey) || "SP";
            }

            const cert = await loadCompanyCertificate(companyId);
            const sefaz = await consultarProtocolo(
                accessKey,
                {
                    uf: uf || "SP",
                    tpAmb: tpAmb || "2",
                },
                cert,
                { debug: process.env.NFE_WS_DEBUG === "1" }
            );
            recoveredNProt = extractNProtFromSefazResponse(sefaz) || null;

            // If we found the protocol, let's also update UF and tpAmb if they were missing
            if (recoveredNProt) {
                await admin
                    .from("nfe_emissions")
                    .update({
                        n_prot: recoveredNProt,
                        uf: canonical?.uf || uf,
                        tp_amb: canonical?.tp_amb || tpAmb,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", emissionId)
                    .eq("company_id", companyId);

                return recoveredNProt;
            }
        } catch (error) {
            console.error(`[ensureEmissionProtocol] SEFAZ error for ${accessKey}:`, error);
            recoveredNProt = null;
        }
    }

    if (!recoveredNProt) return null;

    await admin
        .from("nfe_emissions")
        .update({
            n_prot: recoveredNProt,
            updated_at: new Date().toISOString(),
        })
        .eq("id", emissionId)
        .eq("company_id", companyId);

    return recoveredNProt;
}
