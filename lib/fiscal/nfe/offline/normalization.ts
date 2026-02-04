
/**
 * Normalizes the 'details' object from sales_document_nfes.
 * Handles:
 * 1. Stringified JSON (if column was text)
 * 2. "Char map" corruption (spread string: { "0": "{", "1": "\"", ... })
 * 3. Mixed content (valid keys + char map)
 */
export function normalizeDetails(details: unknown): Record<string, unknown> {
    if (!details) return {};

    let current = details;

    // 1. Handle String
    if (typeof current === 'string') {
        try {
            current = JSON.parse(current);
        } catch (_e) {
            // If simple string, wrap it
            return { legacy_message: current };
        }
    }

    if (typeof current !== 'object' || current === null) {
        return {};
    }

    // 2./3. Handle Char Map / Mixed Corruption
    // Check if it has numeric keys behaving like a spread string
    const keys = Object.keys(current);
    const hasIndexKeys = '0' in current && '1' in current;

    if (hasIndexKeys) {
        try {
            const numericKeys = keys.filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));

            // Reconstruct string to see if it contains valuable info
            let reconstructed = '';
            for (const k of numericKeys) {
                reconstructed += (current as Record<string, string>)[k];
            }

            let parsedOld: any = {};
            try {
                parsedOld = JSON.parse(reconstructed);
            } catch (_e) {
                parsedOld = { legacy_message: reconstructed };
            }

            // Clean current object (remove numeric keys)
            const cleanObj = { ...(current as Record<string, unknown>) };
            for (const k of numericKeys) {
                delete cleanObj[k];
            }

            // Merge: Clean object takes precedence, but if Clean object is empty (only had garbage), use parsedOld.
            // Actually, we want to preserve valid keys from 'current' (like stage: 'SIGNED_OFFLINE')
            // and maybe recover data from 'parsedOld' if missing in 'current'?
            // Usually 'current' is the "latest" state which got corrupted by spreading 'parsedOld'.
            // So 'current' likely has all the fields of 'parsedOld' (if spreading worked? No, spread string doesn't copy props).
            // Wait, spread string `...jsonString` creates `0, 1` keys. It DOES NOT flatten the properties of the object inside the string.
            // So we MUST recover from `parsedOld` if we want the data that was inside the string.

            return {
                ...parsedOld, // Base
                ...cleanObj   // Overwrite with any valid keys found on the corrupted object itself
            };

        } catch (e) {
            console.warn('Error normalizing details, returning original', e);
            return current as Record<string, unknown>;
        }
    }

    return current as Record<string, unknown>;
}
