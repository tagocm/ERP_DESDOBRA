/**
 * Regras para Carta de Correção Eletrônica (CC-e)
 * Baseado no Manual de Orientação do Contribuinte da SEFAZ
 */

export const CCE_USAGE_CONDITIONS = "A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.";

export function normalizeCorrectionText(text: string): string {
    return (text || "")
        .trim()
        .replace(/\s+/g, " ");
}

export function validateCorrectionText(text: string): { valid: boolean; message?: string } {
    const normalized = normalizeCorrectionText(text);

    if (normalized.length < 15) {
        return {
            valid: false,
            message: "O texto da correção deve ter no mínimo 15 caracteres."
        };
    }

    if (normalized.length > 1000) {
        return {
            valid: false,
            message: "O texto da correção deve ter no máximo 1000 caracteres."
        };
    }

    const forbiddenChars = /[<>'"&]/;
    if (forbiddenChars.test(normalized)) {
        return {
            valid: false,
            message: "O texto contém caracteres especiais não permitidos pela SEFAZ (<, >, ', \", &)."
        };
    }

    return { valid: true };
}

export function validateCorrectionSequence(sequence: number): { valid: boolean; message?: string } {
    if (!sequence || sequence < 1) {
        return {
            valid: false,
            message: "Sequência da correção inválida."
        };
    }

    if (sequence > 20) {
        return {
            valid: false,
            message: "Atingido o limite máximo de 20 cartas de correção para esta NF-e."
        };
    }

    return { valid: true };
}
