
export function formatCNPJ(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
    );
}

export function validateCNPJ(value: string): boolean {
    if (!value) return false;

    const cnpj = value.replace(/[^\d]+/g, "");
    if (cnpj.length !== 14) return false;

    // Eliminate invalid known CNPJs
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validate verification digits
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
}

export function extractDigits(value: string): string {
    return value.replace(/\D/g, "");
}
