import { createAdminClient } from '@/lib/supabaseServer';
import { retrievePassword } from '@/lib/vault-helpers';
import { parsePfx } from '../../sign/cert';
import { logger } from "@/lib/logger";

// In-memory cache for certificates
interface CertificateCache {
    pfxBase64: string;
    pfxPassword: string;
    expiresAt: number;
}

const certificateCache = new Map<string, CertificateCache>();

// Pending certificate loads (for deduplication)
const pendingLoads = new Map<string, Promise<{ pfxBase64: string; pfxPassword: string }>>();

// Cache TTL: 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Load company certificate from Supabase Storage and Vault
 * Features:
 * - In-memory cache (15min TTL)
 * - Concurrent request deduplication
 * - PFX validation
 * - Never logs credentials
 */
export async function loadCompanyCertificate(companyId: string): Promise<{ pfxBase64: string; pfxPassword: string }> {
    // 1. Check cache
    const cached = certificateCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
        // Cache hit
        return {
            pfxBase64: cached.pfxBase64,
            pfxPassword: cached.pfxPassword
        };
    }

    // 2. Check if already loading (deduplication)
    const pending = pendingLoads.get(companyId);
    if (pending) {
        // Another request is already loading this certificate
        return await pending;
    }

    // 3. Start loading (and register as pending)
    const loadPromise = loadCertificateFromStorage(companyId);
    pendingLoads.set(companyId, loadPromise);

    try {
        const result = await loadPromise;

        // 4. Cache result
        certificateCache.set(companyId, {
            pfxBase64: result.pfxBase64,
            pfxPassword: result.pfxPassword,
            expiresAt: Date.now() + CACHE_TTL_MS
        });

        // 5. Remove from pending
        pendingLoads.delete(companyId);

        return result;

    } catch (error) {
        // Remove from pending on error
        pendingLoads.delete(companyId);
        throw error;
    }
}

/**
 * Internal: Load certificate from storage
 * NEVER logs pfxBase64 or password
 */
async function loadCertificateFromStorage(companyId: string): Promise<{ pfxBase64: string; pfxPassword: string }> {
    const supabase = createAdminClient();

    // 1. Get company settings
    const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('cert_a1_storage_path, cert_password_encrypted, is_cert_password_saved')
        .eq('company_id', companyId)
        .single();

    if (settingsError || !settings) {
        throw new Error(`Configurações da empresa não encontradas: ${companyId}`);
    }

    if (!settings.cert_a1_storage_path) {
        throw new Error('Certificado não configurado para esta empresa');
    }

    if (!settings.cert_password_encrypted || !settings.is_cert_password_saved) {
        throw new Error('Senha do certificado não configurada');
    }

    // 2. Download PFX from Storage
    const { data: pfxBlob, error: downloadError } = await supabase.storage
        .from('company-assets')
        .download(settings.cert_a1_storage_path);

    if (downloadError || !pfxBlob) {
        throw new Error(`Erro ao baixar certificado: ${downloadError?.message || 'Arquivo não encontrado'}`);
    }

    if (pfxBlob.size === 0) {
        throw new Error('O arquivo do certificado está vazio (0 bytes). Por favor, faça o upload novamente.');
    }

    // 3. Convert to base64
    const arrayBuffer = await pfxBlob.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
        throw new Error('O arquivo do certificado resultou em um Buffer vazio.');
    }
    const pfxBase64 = Buffer.from(arrayBuffer).toString('base64');

    // 4. Retrieve password from Vault
    let pfxPassword: string;
    try {
        pfxPassword = await retrievePassword(settings.cert_password_encrypted);
    } catch (error: any) {
        throw new Error(`Erro ao recuperar senha do certificado: ${error.message}`);
    }

    // 5. Validate PFX
    try {
        const pfxData = parsePfx(pfxBase64, pfxPassword);

        // Ensure it has private key
        if (!pfxData.privateKeyPem || pfxData.privateKeyPem.length === 0) {
            throw new Error('Certificado não contém chave privada');
        }

        // Validate expiration
        if (pfxData.certInfo.notAfter) {
            const expiryDate = new Date(pfxData.certInfo.notAfter);
            if (expiryDate < new Date()) {
                throw new Error(`Certificado expirado em ${expiryDate.toISOString()}`);
            }
        }

    } catch (error: any) {
        throw new Error(`Certificado inválido: ${error.message}`);
    }

    logger.info(`[certificateLoader] Loaded PFX for ${companyId}.`);
    return { pfxBase64, pfxPassword };
}

/**
 * Clear certificate cache for a specific company
 * Useful for forcing reload after certificate update
 */
export function clearCertificateCache(companyId: string): void {
    certificateCache.delete(companyId);
}

/**
 * Clear all certificate caches
 * Useful for maintenance or security
 */
export function clearAllCertificateCaches(): void {
    certificateCache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCertificateCacheStats() {
    const now = Date.now();
    const entries = Array.from(certificateCache.entries());

    return {
        totalCached: entries.length,
        validCached: entries.filter(([_, cert]) => cert.expiresAt > now).length,
        expiredCached: entries.filter(([_, cert]) => cert.expiresAt <= now).length,
        pendingLoads: pendingLoads.size
    };
}
