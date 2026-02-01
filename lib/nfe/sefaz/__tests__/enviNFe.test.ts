import { describe, it, expect } from "vitest";
import { buildEnviNFe } from "../xml/enviNFe";
import { buildConsReciNFe } from "../xml/consReciNFe";

describe("XML Generation", () => {
    it("should build EnviNFe correctly", () => {
        const idLote = "123456";
        const xmlSigned = "<?xml version=\"1.0\"?><NFe>Signed Content</NFe>";
        const result = buildEnviNFe(idLote, xmlSigned);

        // Robust parsing check
        const { DOMParser } = require('@xmldom/xmldom');
        const doc = new DOMParser().parseFromString(result, 'text/xml');

        // Check enviNFe existence generically (ignoring prefix if possible, but xmldom handles namespaces)
        const enviNFe = doc.getElementsByTagName("enviNFe")[0] || doc.getElementsByTagNameNS("*", "enviNFe")[0];
        expect(enviNFe).toBeDefined();

        // Validate fields
        const idLoteNode = enviNFe.getElementsByTagName("idLote")[0];
        const indSincNode = enviNFe.getElementsByTagName("indSinc")[0];

        expect(idLoteNode.textContent).toBe(idLote);
        expect(indSincNode.textContent).toBe("0"); // Default

        // Check NFe content check
        expect(result).toContain("<NFe>Signed Content</NFe>");
    });

    it("should build ConsReciNFe correctly", () => {
        const nRec = "123456789012345";
        const result = buildConsReciNFe(nRec, "2"); // Homolog match

        expect(result).toContain("<consReciNFe");
        expect(result).toContain(`<nRec>${nRec}</nRec>`);
        expect(result).toContain(`<tpAmb>2</tpAmb>`);
    });

    it("should throw error for invalid idLote", () => {
        expect(() => buildEnviNFe("ABC", "")).toThrow(/idLote/);
    });

    it("should throw error for invalid nRec", () => {
        expect(() => buildConsReciNFe("123", "2")).toThrow(/nRec/);
    });
});
