import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import { parsePfx } from "./cert";
import { NfeSignError } from "./errors";
import { SignNfeParams } from "./types";

class EventKeyInfoProvider {
    private certBase64: string;

    constructor(certBase64: string) {
        this.certBase64 = certBase64;
    }

    public getKeyInfo(_: any, prefix: string) {
        const nsPrefix = prefix ? `${prefix}:` : "";
        return `<${nsPrefix}X509Data><${nsPrefix}X509Certificate>${this.certBase64}</${nsPrefix}X509Certificate></${nsPrefix}X509Data>`;
    }
}

export function signEventXml(xml: string, params: SignNfeParams): { signedXml: string } {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const infEventoList = doc.getElementsByTagName("infEvento");

    if (infEventoList.length === 0) {
        throw new NfeSignError("Tag <infEvento> não encontrada no XML de evento.", "XML");
    }

    if (infEventoList.length > 1) {
        throw new NfeSignError("XML de evento inválido: múltiplas tags <infEvento>.", "XML");
    }

    const infEvento = infEventoList[0];
    const id = infEvento.getAttribute("Id");

    if (!id) {
        throw new NfeSignError("Atributo Id não encontrado em <infEvento>.", "XML");
    }

    if (!id.startsWith("ID")) {
        throw new NfeSignError(`Id de evento inválido: "${id}".`, "XML");
    }

    const signatures = doc.getElementsByTagName("Signature");
    if (signatures.length > 0) {
        throw new NfeSignError("XML de evento já assinado.", "XML");
    }

    const pfxData = parsePfx(params.pfxBase64, params.pfxPassword);
    const sig = new SignedXml({ privateKey: pfxData.privateKeyPem });
    const keyInfoProvider = new EventKeyInfoProvider(pfxData.certBase64);

    sig.getKeyInfoContent = (args) => {
        return keyInfoProvider.getKeyInfo(null, args?.prefix || "");
    };

    sig.addReference({
        xpath: "//*[local-name(.)='infEvento']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
        uri: `#${id}`,
        isEmptyUri: false
    });

    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    sig.computeSignature(xml, {
        location: {
            reference: "//*[local-name(.)='infEvento']",
            action: "after"
        }
    });

    return {
        signedXml: sig.getSignedXml()
    };
}
