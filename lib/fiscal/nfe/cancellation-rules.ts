export const NFE_CANCEL_MIN_LENGTH = 15;
export const NFE_CANCEL_MAX_LENGTH = 255;

export function normalizeCancellationReason(input: string): string {
    return String(input || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

export function validateCancellationReason(input: string): { valid: true } | { valid: false; message: string } {
    const normalized = normalizeCancellationReason(input);

    if (!normalized) {
        return { valid: false, message: "O motivo do cancelamento é obrigatório." };
    }

    if (normalized.length < NFE_CANCEL_MIN_LENGTH) {
        return { valid: false, message: `O motivo deve ter no mínimo ${NFE_CANCEL_MIN_LENGTH} caracteres.` };
    }

    if (normalized.length > NFE_CANCEL_MAX_LENGTH) {
        return { valid: false, message: `O motivo deve ter no máximo ${NFE_CANCEL_MAX_LENGTH} caracteres.` };
    }

    return { valid: true };
}
