/**
 * Upload Helpers
 * Utilities for file validation and upload management
 */

export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
export const ALLOWED_CERT_TYPES = ['application/x-pkcs12', 'application/pkcs12'];
export const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_CERT_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate logo file
 */
export function validateLogoFile(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_LOGO_SIZE) {
        return {
            valid: false,
            error: `Arquivo muito grande. Tamanho máximo: ${MAX_LOGO_SIZE / 1024 / 1024}MB`
        };
    }

    // Check file type
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: 'Tipo de arquivo não permitido. Use PNG, JPG, SVG ou WebP'
        };
    }

    return { valid: true };
}

/**
 * Validate certificate file
 */
export function validateCertFile(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_CERT_SIZE) {
        return {
            valid: false,
            error: `Arquivo muito grande. Tamanho máximo: ${MAX_CERT_SIZE / 1024 / 1024}MB`
        };
    }

    // Check file extension (MIME type might not be reliable for .pfx/.p12)
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pfx') && !fileName.endsWith('.p12')) {
        return {
            valid: false,
            error: 'Tipo de arquivo não permitido. Use .pfx ou .p12'
        };
    }

    return { valid: true };
}

/**
 * Generate unique file path for storage
 */
export function generateFilePath(
    companyId: string,
    type: 'logo' | 'cert',
    fileName: string
): string {
    const timestamp = Date.now();
    const extension = fileName.split('.').pop();

    if (type === 'logo') {
        return `companies/${companyId}/logo/${timestamp}.${extension}`;
    } else {
        return `companies/${companyId}/certs/a1/${timestamp}.pfx`;
    }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
    return fileName.split('.').pop() || '';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
