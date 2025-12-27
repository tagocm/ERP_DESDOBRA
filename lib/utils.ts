
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Converts a string to Title Case with Portuguese language support
 * - First letter of each word capitalized
 * - Preserves common acronyms (LTDA, EIRELI, ME, EPP, SA, etc.)
 * - Handles prepositions intelligently
 * - Handles special characters (hyphens, parentheses, etc.)
 */
export function toTitleCase(str: string | null | undefined): string | null {
    if (!str) return null;

    // Common Portuguese prepositions and articles that should stay lowercase (except at start)
    const lowercaseWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'a', 'o', 'as', 'os']);

    // Common business acronyms that should stay uppercase
    const acronyms = new Set(['ltda', 'eireli', 'me', 'epp', 'sa', 'ss', 'coop', 'cia']);

    const trimmed = str.trim().replace(/\s+/g, ' '); // Normalize spaces

    return trimmed
        .toLowerCase()
        .split(' ')
        .map((word, index) => {
            if (word.length === 0) return word;

            // Check if it's an acronym
            const cleanWord = word.replace(/[.,()]/g, '');
            if (acronyms.has(cleanWord)) {
                return word.toUpperCase();
            }

            // Handle hyphenated words (e.g., "Guará-Mirim", "Zona Sul-Americana")
            if (word.includes('-')) {
                return word.split('-')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join('-');
            }

            // First word is always capitalized
            if (index === 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }

            // Check if it's a preposition/article (keep lowercase unless first word)
            if (lowercaseWords.has(word)) {
                return word;
            }

            // Default: capitalize first letter
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

/**
 * Applies Title Case to specific fields in an object
 * @param data - The object containing the data
 * @param fields - Array of field names to apply Title Case to
 * @returns New object with Title Case applied to specified fields
 */
export function applyTitleCaseToObject<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[]
): T {
    const result = { ...data };

    for (const field of fields) {
        const value = result[field];
        if (typeof value === 'string') {
            result[field] = toTitleCase(value) as any;
        }
    }

    return result;
}

export function normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    return email.toLowerCase().trim();
}

export function formatCurrency(value: number | string | null | undefined): string {
    const numberValue = Number(value);
    if (isNaN(numberValue)) return "R$ 0,00";

    return numberValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}
