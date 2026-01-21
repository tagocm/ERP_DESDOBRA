export function buildConsReciNFe(nRec: string, tpAmb: "1" | "2"): string {
    if (!/^\d{15}$/.test(nRec)) {
        throw new Error("nRec deve ter 15 dígitos.");
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <nRec>${nRec}</nRec>
</consReciNFe>`;
}
