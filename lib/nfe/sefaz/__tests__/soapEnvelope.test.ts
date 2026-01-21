import { describe, it, expect } from "vitest";
import { buildSoapEnvelope, buildSoapEnvelopeRet } from "../soap/soapEnvelope";

describe("SOAP Envelope", () => {
    it("should build standard envelope", () => {
        const body = "<test>Body</test>";
        const result = buildSoapEnvelope(body);

        expect(result).toContain("soap12:Envelope");
        expect(result).toContain("nfeDadosMsg");
        expect(result).toContain("NFeAutorizacao4");
        expect(result).toContain(body);
    });

    it("should build ret envelope", () => {
        const body = "<test>BodyRet</test>";
        const result = buildSoapEnvelopeRet(body);

        expect(result).toContain("soap12:Envelope");
        expect(result).toContain("nfeDadosMsg");
        expect(result).toContain("NFeRetAutorizacao4");
        expect(result).toContain(body);
    });
});
