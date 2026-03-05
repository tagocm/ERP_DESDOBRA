import { gunzipSync, gzipSync } from "node:zlib";

function sanitizeBase64(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

export function decodeInboundXml(input: { xmlBase64: string; xmlIsGz: boolean }): string {
  const normalized = sanitizeBase64(input.xmlBase64);
  const buffer = Buffer.from(normalized, "base64");
  const xmlBuffer = input.xmlIsGz ? gunzipSync(buffer) : buffer;
  return xmlBuffer.toString("utf8");
}

export function encodeInboundXml(xml: string, gzip = false): { xmlBase64: string; xmlIsGz: boolean } {
  const raw = Buffer.from(xml, "utf8");
  if (!gzip) {
    return { xmlBase64: raw.toString("base64"), xmlIsGz: false };
  }

  const compressed = gzipSync(raw);
  return { xmlBase64: compressed.toString("base64"), xmlIsGz: true };
}
