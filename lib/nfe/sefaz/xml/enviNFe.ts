export function buildEnviNFe(idLote: string, xmlNfeAssinado: string, indSinc: "0" | "1" = "0"): string {
  // Validação básica do idLote
  if (!/^\d{1,15}$/.test(idLote)) {
    throw new Error("idLote deve ser numérico e ter até 15 dígitos.");
  }

  // Opcional: remover header XML do xmlNfeAssinado (<?xml...?>) se existir,
  // embora SEFAZ geralmente aceite, é boa prática limpar para ser filho.
  const nfeContent = xmlNfeAssinado.replace(/<\?xml.*?\?>/g, "").trim();

  return `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>${indSinc}</indSinc>${nfeContent}</enviNFe>`;
}
