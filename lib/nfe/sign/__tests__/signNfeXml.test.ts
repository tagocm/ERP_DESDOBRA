import { describe, it, expect, beforeAll } from "vitest";
import { signNfeXml } from "../signNfeXml";
import { NfeSignError } from "../errors";
import fs from "fs";
import path from "path";

describe("signNfeXml", () => {
    let pfxBase64: string;
    const pfxPassword = "1234";
    const validId = "NFe35231012345678000199550010000010011000000018";
    const draftId = "NFe" + "0".repeat(44);

    const validXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="${validId}" versao="4.00"><ide><cNF>123</cNF></ide></infNFe></NFe>`;
    const draftXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="${draftId}" versao="4.00"><ide><cNF>123</cNF></ide></infNFe></NFe>`;

    beforeAll(() => {
        const pfxPath = path.resolve(process.cwd(), "lib/nfe/sign/fixtures/test.pfx");
        const pfxBuffer = fs.readFileSync(pfxPath);
        pfxBase64 = pfxBuffer.toString("base64");
    });

    it("should sign a valid XML successfully", () => {
        const result = signNfeXml(validXml, { pfxBase64, pfxPassword });

        expect(result.signedXml).toContain("<Signature");
        expect(result.signedXml).toMatch(new RegExp(`URI=["']#${validId}["']`));
        expect(result.signedXml).toContain("<X509Certificate>");
        expect(result.certInfo.subject).toBeDefined();

        // Ensure EXACTLY one signature
        const sigCount = (result.signedXml.match(/<Signature\b/g) || []).length;
        expect(sigCount).toBe(1);

        // Ensure signature is inside infNFe
        const infNfeStart = result.signedXml.indexOf("<infNFe");
        const infNfeEnd = result.signedXml.indexOf("</infNFe>");
        const signatureStart = result.signedXml.indexOf("<Signature");

        expect(infNfeStart).toBeGreaterThan(-1);
        expect(infNfeEnd).toBeGreaterThan(-1);
        expect(signatureStart).toBeGreaterThan(infNfeStart);
        expect(signatureStart).toBeLessThan(infNfeEnd);
    });

    it("should throw error if Id is draft (zeros)", () => {
        try {
            signNfeXml(draftXml, { pfxBase64, pfxPassword });
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeSignError);
            expect(error.code).toBe("DADOS");
        }
    });

    it("should throw error if PFX password is wrong", () => {
        try {
            signNfeXml(validXml, { pfxBase64, pfxPassword: "wrong" });
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeSignError);
            expect(error.code).toBe("CERT");
        }
    });

    it("should throw error if XML is already signed", () => {
        const result = signNfeXml(validXml, { pfxBase64, pfxPassword });
        try {
            signNfeXml(result.signedXml, { pfxBase64, pfxPassword });
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeSignError);
            expect(error.message).toContain("já possui assinatura");
        }
    });

    it("should throw error if malformed XML (no infNFe)", () => {
        const badXml = "<root>test</root>";
        try {
            signNfeXml(badXml, { pfxBase64, pfxPassword });
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeSignError);
            expect(error.message).toContain("não encontrada");
        }
    });
});
