import { describe, it, expect } from "vitest";
import { buildNfeXml } from "../xml/buildNfeXml";
import { NfeDraft } from "../domain/types";
import { NfeBuildError } from "../domain/errors";
import basicDraft from "./fixtures/nfeDraft.basic.json";

describe("buildNfeXml", () => {
    it("should build a valid XML from basic fixture", () => {
        const result = buildNfeXml(basicDraft as any as NfeDraft);
        expect(result.xml).toBeDefined();
        expect(result.xml).toContain("<NFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">");
        expect(result.xml).toContain("<infNFe versao=\"4.00\"");
        expect(result.xml).toContain("<emit>");
        expect(result.xml).toContain("<dest>");
        expect(result.xml).toContain("<det nItem=\"1\">");

        // Formatação decimal
        expect(result.xml).toContain("<vProd>500.00</vProd>");
        expect(result.xml).toContain("<qCom>10.0000</qCom>");

        // Snapshot para garantir determinismo
        expect(result.xml).toMatchSnapshot();
    });

    it("should throw validation error if NCM is missing", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        draft.itens[0].prod.ncm = "123"; // Inválido (deve ter 8)

        try {
            buildNfeXml(draft);
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeBuildError);
            expect(error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: "itens.0.prod.ncm",
                        code: "DADOS"
                    })
                ])
            );
        }
    });

    it("should throw validation error if totals mismatch", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        draft.itens[0].prod.vProd = 10.00; // Inconsistente com qCom * vUnCom (500.00)

        try {
            buildNfeXml(draft);
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeBuildError);
            expect(error.issues[0].message).toContain("diverge do calculado");
        }
    });

    it("should use PISAliq and COFINSAliq for CST 01", () => {
        const result = buildNfeXml(basicDraft as any as NfeDraft);
        expect(result.xml).toContain("<PISAliq>");
        expect(result.xml).toContain("<COFINSAliq>");
        expect(result.xml).not.toContain("<PISOutr>");
        expect(result.xml).not.toContain("<COFINSOutr>");
    });

    it("should use PISNT and COFINSNT for CST 04", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        // Remove CST 01 relevant fields
        delete draft.itens[0].imposto.pis.vBC;
        delete draft.itens[0].imposto.pis.pPIS;
        delete draft.itens[0].imposto.pis.vPIS;
        delete draft.itens[0].imposto.cofins.vBC;
        delete draft.itens[0].imposto.cofins.pCOFINS;
        delete draft.itens[0].imposto.cofins.vCOFINS;

        draft.itens[0].imposto.pis.cst = "04";
        draft.itens[0].imposto.cofins.cst = "04";

        const result = buildNfeXml(draft);
        expect(result.xml).toContain("<PISNT>");
        expect(result.xml).toContain("<COFINSNT>");
    });


    it("should throw validation error if CST 01 is missing vBC/pPIS", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        draft.itens[0].imposto.pis.cst = "01";
        delete draft.itens[0].imposto.pis.vBC;

        try {
            buildNfeXml(draft);
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeBuildError);
            expect(error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: "itens[0].imposto.pis.vBC",
                        message: "PIS CST 01/02 exige vBC"
                    })
                ])
            );
        }
    });

    it("should format dhEmi with correct timezone offset", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        draft.ide.dhEmi = "2023-10-27T10:00:00Z";
        const result = buildNfeXml(draft, { tzOffset: "-03:00" });
        expect(result.xml).toContain("<dhEmi>2023-10-27T10:00:00-03:00</dhEmi>");
        expect(result.xml).not.toContain("Z</dhEmi>");
    });

    it("should generate correct Id and cDV in draft mode without key", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        delete draft.ide.chNFe;
        const result = buildNfeXml(draft, { mode: "draft" });
        // NFe + 44 zeros
        const expectedId = "NFe" + "0".repeat(44);
        expect(result.xml).toContain(`Id="${expectedId}"`);
        expect(result.xml).toContain("<cDV>0</cDV>");
    });

    it("should generate correct Id and cDV in draft mode WITH key", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        const key = "35231012345678000199550010000010011000000018";
        draft.ide.chNFe = key;
        const result = buildNfeXml(draft, { mode: "draft" });
        expect(result.xml).toContain(`Id="NFe${key}"`);
        expect(result.xml).toContain("<cDV>8</cDV>"); // Last digit is 8
    });

    it("should throw error in transmissible mode without key", () => {
        const draft = JSON.parse(JSON.stringify(basicDraft));
        delete draft.ide.chNFe;
        try {
            buildNfeXml(draft, { mode: "transmissible" });
        } catch (error: any) {
            expect(error).toBeInstanceOf(NfeBuildError);
            expect(error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: "ide.chNFe",
                        code: "PARAMETRIZACAO"
                    })
                ])
            );
        }
    });
});
