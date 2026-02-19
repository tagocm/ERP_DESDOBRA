import { logger } from "@/lib/logger";

type SupabaseLike = any;

function isExpectedCompanyAssetPath(path: string, companyId: string): boolean {
    const prefixes = [`companies/${companyId}/`, `${companyId}/`];
    return prefixes.some((p) => path.startsWith(p));
}

function normalizeLogoPath(rawPath: string): string {
    const trimmed = rawPath.trim().replace(/^\/+/, "");
    if (trimmed.startsWith("company-assets/")) {
        return trimmed.slice("company-assets/".length);
    }
    return trimmed;
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
}

function isBlobUrl(value: string): boolean {
    return /^blob:/i.test(value);
}

function guessMimeTypeFromPath(path: string): string {
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith(".svg")) return "image/svg+xml";
    if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
    if (lowerPath.endsWith(".webp")) return "image/webp";
    if (lowerPath.endsWith(".gif")) return "image/gif";
    return "image/png";
}

async function downloadLogoAsDataUri(
    supabase: SupabaseLike,
    path: string
): Promise<string | undefined> {
    const { data, error } = await supabase.storage
        .from("company-assets")
        .download(path);

    if (error || !data) {
        logger.warn("[NFE Logo] Failed to download logo path", {
            path,
            message: error?.message || "empty data",
        });
        return undefined;
    }

    try {
        const buffer = Buffer.from(await data.arrayBuffer());
        const mimeType = (data as any)?.type || guessMimeTypeFromPath(path);
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (error: any) {
        logger.warn("[NFE Logo] Failed to convert logo buffer", {
            path,
            message: error?.message || "unknown error",
        });
        return undefined;
    }
}

async function fetchRemoteLogoAsDataUri(url: string): Promise<string | undefined> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            logger.warn("[NFE Logo] Failed to fetch remote logo URL", {
                status: response.status,
                url,
            });
            return undefined;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/png";
        return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (error: any) {
        logger.warn("[NFE Logo] Failed to fetch remote logo URL", {
            url,
            message: error?.message || "unknown error",
        });
        return undefined;
    }
}

async function createSignedLogoUrl(
    supabase: SupabaseLike,
    path: string
): Promise<string | undefined> {
    const { data, error } = await supabase.storage
        .from("company-assets")
        .createSignedUrl(path, 3600);

    if (error) {
        logger.warn("[NFE Logo] Failed to sign logo path", { path, message: error.message });
        return undefined;
    }

    return data?.signedUrl;
}

export async function resolveCompanyLogoUrl(
    supabase: SupabaseLike,
    companyId?: string | null
): Promise<string | undefined> {
    if (!companyId) return undefined;

    const { data: settings, error } = await supabase
        .from("company_settings")
        .select("logo_path")
        .eq("company_id", companyId)
        .maybeSingle();

    if (error) {
        logger.warn("[NFE Logo] Failed to fetch company settings", {
            companyId,
            message: error.message,
        });
    }

    const rawLogoPath = settings?.logo_path;
    let externalUrl: string | undefined;
    if (typeof rawLogoPath === "string" && rawLogoPath.trim()) {
        if (isHttpUrl(rawLogoPath)) {
            externalUrl = rawLogoPath;
        } else if (isBlobUrl(rawLogoPath)) {
            logger.warn("[NFE Logo] Ignoring blob logo_path", { companyId });
        } else {
            const logoPath = normalizeLogoPath(rawLogoPath);
            if (isExpectedCompanyAssetPath(logoPath, companyId)) {
                const signed = await createSignedLogoUrl(supabase, logoPath);
                if (signed) return signed;
            }
        }
    }

    // Fallback: if logo_path is empty or stale, try newest file in default logo folder.
    for (const folder of [`companies/${companyId}/logo`, `${companyId}/logo`]) {
        const { data: files, error: listError } = await supabase.storage
            .from("company-assets")
            .list(folder, {
                limit: 50,
                sortBy: { column: "name", order: "desc" },
            });

        if (listError) {
            logger.warn("[NFE Logo] Failed to list logo folder", {
                companyId,
                folder,
                message: listError.message,
            });
            continue;
        }

        const candidate = (files || [])
            .filter((file: any) => file && file.name && !file.name.endsWith("/"))
            .sort((a: any, b: any) => {
                const aDate = new Date(a?.updated_at || a?.created_at || 0).getTime();
                const bDate = new Date(b?.updated_at || b?.created_at || 0).getTime();
                return bDate - aDate;
            })[0];

        if (!candidate?.name) continue;
        const fallbackPath = `${folder}/${candidate.name}`;
        const signed = await createSignedLogoUrl(supabase, fallbackPath);
        if (signed) return signed;
    }

    return externalUrl;
}

export async function resolveCompanyLogoDataUri(
    supabase: SupabaseLike,
    companyId?: string | null
): Promise<string | undefined> {
    if (!companyId) return undefined;

    const { data: settings, error } = await supabase
        .from("company_settings")
        .select("logo_path")
        .eq("company_id", companyId)
        .maybeSingle();

    if (error) {
        logger.warn("[NFE Logo] Failed to fetch company settings (dataUri)", {
            companyId,
            message: error.message,
        });
    }

    const rawLogoPath = settings?.logo_path;
    const candidatePaths: string[] = [];
    if (typeof rawLogoPath === "string" && rawLogoPath.trim()) {
        if (isHttpUrl(rawLogoPath)) {
            const remoteDataUri = await fetchRemoteLogoAsDataUri(rawLogoPath);
            if (remoteDataUri) {
                return remoteDataUri;
            }
        } else if (isBlobUrl(rawLogoPath)) {
            logger.warn("[NFE Logo] Ignoring blob logo_path (dataUri)", { companyId });
        } else {
            const logoPath = normalizeLogoPath(rawLogoPath);
            if (isExpectedCompanyAssetPath(logoPath, companyId)) {
                candidatePaths.push(logoPath);
            }
        }
    }

    for (const folder of [`companies/${companyId}/logo`, `${companyId}/logo`]) {
        const { data: files, error: listError } = await supabase.storage
            .from("company-assets")
            .list(folder, {
                limit: 50,
                sortBy: { column: "name", order: "desc" },
            });

        if (listError) {
            logger.warn("[NFE Logo] Failed to list logo folder (dataUri)", {
                companyId,
                folder,
                message: listError.message,
            });
            continue;
        }

        const candidate = (files || [])
            .filter((file: any) => file && file.name && !file.name.endsWith("/"))
            .sort((a: any, b: any) => {
                const aDate = new Date(a?.updated_at || a?.created_at || 0).getTime();
                const bDate = new Date(b?.updated_at || b?.created_at || 0).getTime();
                return bDate - aDate;
            })[0];

        if (candidate?.name) {
            candidatePaths.push(`${folder}/${candidate.name}`);
        }
    }

    const seen = new Set<string>();
    for (const candidatePath of candidatePaths) {
        if (!candidatePath || seen.has(candidatePath)) continue;
        seen.add(candidatePath);
        const dataUri = await downloadLogoAsDataUri(supabase, candidatePath);
        if (dataUri) return dataUri;
    }

    return undefined;
}
