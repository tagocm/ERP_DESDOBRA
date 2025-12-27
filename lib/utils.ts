
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function toTitleCase(str: string | null | undefined): string | null {
    if (!str) return null;
    return str
        .toLowerCase()
        .split(' ')
        .map(word => {
            if (word.length === 0) return word;
            // Don't capitalize short prepositions if you want a stricter rule, 
            // but for "Title Case" of names usually we capitalize everything or have an exception list.
            // User asked for "A primeira letra de cada palavra maiuscula e as demais minusculas".
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
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
