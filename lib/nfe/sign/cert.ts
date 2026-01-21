import forge from "node-forge";
import { NfeSignError } from "./errors";

export interface PfxData {
    privateKeyPem: string;
    certificatePem: string;
    certBase64: string; // DER in base64 without headers (for XML)
    certInfo: {
        subject: string;
        serial: string;
        notBefore: string;
        notAfter: string;
    }
}

export function parsePfx(pfxBase64: string, password: string): PfxData {
    try {
        const pfxDer = forge.util.decode64(pfxBase64);
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);

        // Decrypt PFX
        // Note: node-forge might optionally require loose matching or handling specific algorithms
        const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

        // Get safe bags
        const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certBag = bags[forge.pki.oids.certBag]?.[0];

        if (!certBag) {
            throw new NfeSignError("Certificado não encontrado no arquivo PFX", "CERT");
        }

        const cert = certBag.cert;
        if (!cert) {
            throw new NfeSignError("Certificado inválido ou corrompido", "CERT");
        }

        // Get key
        // Keys can be in keyBag or pkcs8ShroudedKeyBag
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

        // Also check simplified keyBag if not shrouded
        const simpleKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
        const simpleKeyBag = simpleKeyBags[forge.pki.oids.keyBag]?.[0];

        const key = keyBag?.key || simpleKeyBag?.key;

        if (!key) {
            throw new NfeSignError("Chave privada não encontrada no arquivo PFX", "CERT");
        }

        // Convert to PEM/Format requirements
        const privateKeyPem = forge.pki.privateKeyToPem(key);
        const certificatePem = forge.pki.certificateToPem(cert);

        // For XMLDSig, we usually need the body of the cert in base64 (without headers)
        // forge.pki.certificateToPem adds headers. We can strip them or convert using DER.
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        const certBase64 = forge.util.encode64(certDer);

        // Extract info
        const subject = cert.subject.attributes
            .map(attr => `${attr.shortName || attr.name}=${attr.value}`)
            .join(",");

        return {
            privateKeyPem,
            certificatePem,
            certBase64,
            certInfo: {
                subject,
                serial: cert.serialNumber,
                notBefore: cert.validity.notBefore.toISOString(),
                notAfter: cert.validity.notAfter.toISOString()
            }
        };

    } catch (err: any) {
        if (err instanceof NfeSignError) throw err;
        throw new NfeSignError("Erro ao ler PFX: " + (err.message || err), "CERT");
    }
}
