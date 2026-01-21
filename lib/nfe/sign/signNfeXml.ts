import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import { SignNfeParams, SignNfeResult } from "./types";
import { NfeSignError } from "./errors";
import { parsePfx } from "./cert";

// Custom KeyInfo provider to output X509Data/X509Certificate
class NfeKeyInfoProvider {
    private certBase64: string;

    constructor(certBase64: string) {
        this.certBase64 = certBase64;
    }

    public getKeyInfo(key: any, prefix: string) {
        prefix = prefix ? prefix + ":" : "";
        return `<${prefix}X509Data><${prefix}X509Certificate>${this.certBase64}</${prefix}X509Certificate></${prefix}X509Data>`;
    }

    public getKey(keyInfo: any) {
        // Not used during signing, only verification
        return Buffer.from(this.certBase64, 'base64');
    }
}

export function signNfeXml(xml: string, params: SignNfeParams): SignNfeResult {
    // 1. Parse XML
    const doc = new DOMParser().parseFromString(xml, "text/xml");

    // 2. Locate infNFe and validate Id
    // Note: use local-name to avoid namespace issues if present/variable (though NFe usually has xmlns)
    const infNFeList = doc.getElementsByTagName("infNFe");

    if (infNFeList.length === 0) {
        throw new NfeSignError("Tag <infNFe> não encontrada no XML", "XML");
    }
    if (infNFeList.length > 1) {
        throw new NfeSignError("Múltiplas tags <infNFe> encontradas", "XML");
    }

    const infNFe = infNFeList[0];
    const id = infNFe.getAttribute("Id");

    if (!id) {
        throw new NfeSignError("Atributo Id não encontrado em <infNFe>", "XML");
    }

    // Id format: "NFe" + 44 digits
    if (!id.startsWith("NFe") || id.length !== 47) {
        throw new NfeSignError(`Id inválido: "${id}". Deve ser "NFe" seguido de 44 dígitos.`, "XML");
    }

    const chNFe = id.substring(3); // 44 digits
    // Check for draft (all zeros)
    if (/^0+$/.test(chNFe)) {
        throw new NfeSignError("XML em modo Draft (chave zerada) não pode ser assinado.", "DADOS");
    }

    // 3. Check if already signed
    const signatures = doc.getElementsByTagName("Signature");
    if (signatures.length > 0) {
        throw new NfeSignError("XML já possui assinatura", "XML");
    }

    // 4. Load Certificate
    const pfxData = parsePfx(params.pfxBase64, params.pfxPassword);

    // 5. Configure xml-crypto
    const sig = new SignedXml({
        privateKey: pfxData.privateKeyPem
    });

    // Override getKeyInfoContent to use our custom provider logic
    const keyInfoProvider = new NfeKeyInfoProvider(pfxData.certBase64);
    sig.getKeyInfoContent = (args) => {
        return keyInfoProvider.getKeyInfo(null, args?.prefix || "");
    };

    // Configure Reference with Object interface (xml-crypto 6.x)
    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
        uri: `#${id}`,
        isEmptyUri: false
    });

    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1"; // SEFAZ uses SHA1

    // 6. Compute Signature
    // CRITICAL: Signature must be placed as SIBLING of infNFe, NOT inside it
    // XSD structure: <NFe><infNFe>...</infNFe><Signature>...</Signature></NFe>
    // Using "after" action to place Signature AFTER closing </infNFe>
    sig.computeSignature(xml, {
        location: {
            reference: "//*[local-name(.)='infNFe']",
            action: "after"  // Changed from "append" to "after" for XSD compliance
        }
    });

    const signedXml = sig.getSignedXml();

    // 7. Return
    return {
        signedXml,
        certInfo: pfxData.certInfo
    };
}
