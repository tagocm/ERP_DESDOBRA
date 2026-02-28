const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRASILIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRASILIA_TIME_ZONE,
    timeZoneName: "shortOffset",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    const part = parts.find((item) => item.type === type);
    if (!part || !part.value) {
        throw new Error(`Falha ao resolver componente de data (${type}) no fuso de Brasília.`);
    }
    return part.value;
}

function resolveBrasiliaOffset(date: Date): string {
    const parts = offsetFormatter.formatToParts(date);
    const tzPart = getPart(parts, "timeZoneName");
    const match = tzPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
    if (!match) return "-03:00";

    const sign = match[1];
    const hours = match[2].padStart(2, "0");
    const minutes = (match[3] || "00").padStart(2, "0");
    return `${sign}${hours}:${minutes}`;
}

export function formatDateTimeInBrasilia(date: Date): string {
    const parts = datePartsFormatter.formatToParts(date);
    const year = getPart(parts, "year");
    const month = getPart(parts, "month");
    const day = getPart(parts, "day");
    const hour = getPart(parts, "hour");
    const minute = getPart(parts, "minute");
    const second = getPart(parts, "second");
    const offset = resolveBrasiliaOffset(date);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

