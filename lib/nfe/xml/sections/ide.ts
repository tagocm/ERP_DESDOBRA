import { NfeIde } from "../../domain/types";


function formatNfeDateTime(input: string | Date, tzOffset: string): string {
    const d = new Date(input);
    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    // XSD NF-e 4.00 Pattern: YYYY-MM-DDTHH:MM:SS±HH:MM (NO milliseconds)
    // Format: ISO 8601 without milliseconds
    // Example: "2026-01-16T19:25:04-03:00"

    // Build datetime string WITHOUT milliseconds
    const datetime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

    // Append timezone offset
    return `${datetime}${tzOffset}`;
}

export function buildIde(ide: NfeIde, cDV: string, tzOffset: string) {
    return {
        cUF: ide.cUF,
        cNF: ide.cNF || "12345678",
        natOp: ide.natOp,
        mod: ide.mod,
        serie: ide.serie,
        nNF: ide.nNF,
        dhEmi: formatNfeDateTime(ide.dhEmi, tzOffset),
        tpNF: ide.tpNF,
        idDest: ide.idDest,
        cMunFG: ide.cMunFG,
        tpImp: ide.tpImp,
        tpEmis: ide.tpEmis,
        cDV: cDV,
        tpAmb: ide.tpAmb,
        finNFe: ide.finNFe,
        indFinal: ide.indFinal,
        indPres: ide.indPres,
        procEmi: ide.procEmi,
        verProc: ide.verProc
    };
}
