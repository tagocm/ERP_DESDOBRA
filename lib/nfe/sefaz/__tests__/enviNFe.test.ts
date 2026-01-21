import { describe, it, expect } from "vitest";
import { buildEnviNFe } from "../xml/enviNFe";
import { buildConsReciNFe } from "../xml/consReciNFe";

describe("XML Generation", () => {
    it("should build EnviNFe correctly", () => {
        const idLote = "123456";
        const xmlSigned = "<?xml version=\"1.0\"?><NFe>Signed Content</NFe>";
        const result = buildEnviNFe(idLote, xmlSigned);

        expect(result).toContain("<enviNFe");
        expect(result).toContain(`<idLote>${idLote}</idLote>`);
        expect(result).toContain(`<indSinc>0</indSinc>`); // Default
        expect(result).toContain("<NFe>Signed Content</NFe>");

        // Should have exactly ONE xml header (the global one), stripping the inner one
        const headerMatches = result.match(/<\?xml/g);
        expect(headerMatches).toHaveLength(1);
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
