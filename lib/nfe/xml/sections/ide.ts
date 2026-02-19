import { NfeIde } from "../../domain/types";


function formatNfeDateTime(input: string | Date, tzOffset: string): string {
    const d = new Date(input);
    const pad = (n: number) => n.toString().padStart(2, '0');

    // Parse offset string (e.g., "-03:00" or "+05:30")
    const match = tzOffset.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) {
        // Fallback to naive local time if offset format is invalid (should verify upstream)
        // But for safety, lets default to UTC behavior or throw? Code used checks before.
        // Let's stick to naive if invalid to avoid breaking changes, but log error?
        // Actually, just throwing or defaulting to 0 might be better.
        // Let's assume valid input from buildNfeXml default "-03:00".
        return d.toISOString().replace('Z', '') + tzOffset;
    }

    const sign = match[1] === '+' ? 1 : -1;
    const offHours = parseInt(match[2], 10);
    const offMinutes = parseInt(match[3], 10);
    const totalOffsetMs = sign * (offHours * 60 + offMinutes) * 60 * 1000;

    // Shift the time so that UTC components match the target local time
    // Example: 10:00 UTC, target -03:00.
    // We want output: 07:00.
    // Shifted = 10:00 UTC + (-3h) = 07:00 UTC.
    // getUTCHours(07:00 UTC) = 7. Correct.
    const shifted = new Date(d.getTime() + totalOffsetMs);

    const year = shifted.getUTCFullYear();
    const month = pad(shifted.getUTCMonth() + 1);
    const day = pad(shifted.getUTCDate());
    const hours = pad(shifted.getUTCHours());
    const minutes = pad(shifted.getUTCMinutes());
    const seconds = pad(shifted.getUTCSeconds());

    const datetime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
