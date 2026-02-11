export const CCE_MIN_LENGTH = 15;
export const CCE_MAX_LENGTH = 1000;

export const CCE_USAGE_CONDITIONS =
    "A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.";

export function normalizeCorrectionText(input: string): string {
    return String(input || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

export function validateCorrectionText(input: string): { valid: true } | { valid: false; message: string } {
    const normalized = normalizeCorrectionText(input);

    if (!normalized) {
        return { valid: false, message: "A descrição da correção é obrigatória." };
    }

    if (normalized.length < CCE_MIN_LENGTH) {
        return { valid: false, message: `A descrição deve ter no mínimo ${CCE_MIN_LENGTH} caracteres.` };
    }

    if (normalized.length > CCE_MAX_LENGTH) {
        return { valid: false, message: `A descrição deve ter no máximo ${CCE_MAX_LENGTH} caracteres.` };
    }

    return { valid: true };
}
