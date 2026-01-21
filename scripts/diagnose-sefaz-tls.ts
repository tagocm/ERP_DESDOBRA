
import tls from 'tls';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';

const SEFAZ_URL = process.argv[2] || "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx";
const DEBUG_DIR = "/tmp/desdobra-sefaz";

console.log(`[Diagnostic] Diagnosing TLS connection to: ${SEFAZ_URL}`);
console.log(`[Diagnostic] Node Version: ${process.version}`);
console.log(`[Diagnostic] Platform: ${process.platform}`);

if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function runDiagnostic() {
    try {
        const u = new URL(SEFAZ_URL);
        const port = u.port ? parseInt(u.port) : 443;
        const host = u.hostname;

        console.log(`[Diagnostic] Connecting to ${host}:${port}...`);

        const socket = tls.connect({
            host: host,
            port: port,
            rejectUnauthorized: false, // We want to inspect the cert even if invalid
            servername: host
        }, () => {
            console.log('[Diagnostic] Connected via TLS!');
            console.log(`[Diagnostic] Cipher: ${JSON.stringify(socket.getCipher(), null, 2)}`);
            console.log(`[Diagnostic] Protocol: ${socket.getProtocol()}`);

            const peerCert = socket.getPeerCertificate(true); // detailed = true

            if (peerCert) {
                console.log('\n--- Server Certificate ---');
                console.log(`Subject: ${peerCert.subject.CN}`);
                console.log(`Issuer: ${peerCert.issuer.CN}`);
                console.log(`Valid From: ${peerCert.valid_from}`);
                console.log(`Valid To: ${peerCert.valid_to}`);
                console.log(`Fingerprint: ${peerCert.fingerprint}`);

                // Save cert to file
                const certPath = path.join(DEBUG_DIR, `server-cert-${host}.pem`);
                fs.writeFileSync(certPath, `-----BEGIN CERTIFICATE-----\n${peerCert.raw.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`);
                console.log(`[Diagnostic] Saved server certificate to: ${certPath}`);

                // Analyze Chain
                let current = peerCert;
                let depth = 0;
                console.log('\n--- Certificate Chain ---');
                while (current.issuerCertificate && current.issuerCertificate !== current) {
                    depth++;
                    current = current.issuerCertificate;
                    console.log(`[Level ${depth}] Subject: ${current.subject.CN}`);
                    console.log(`           Issuer: ${current.issuer.CN}`);

                    const chainPath = path.join(DEBUG_DIR, `chain-${depth}-${host}.pem`);
                    fs.writeFileSync(chainPath, `-----BEGIN CERTIFICATE-----\n${current.raw.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`);
                }

                if (depth === 0) {
                    console.log('[Diagnostic] WARNING: No intermediate certificates sent by server. Node.js might fail to build the chain to a trusted root if the intermediate is missing from local store.');
                }

                console.log('\n--- Validation Analysis ---');

                // Try to validate strictly now
                // Reconnect strictly
                console.log('\n--- Strict Validation Analysis ---');

                let ca: Buffer | undefined;
                if (process.env.SEFAZ_CA_BUNDLE_PATH && fs.existsSync(process.env.SEFAZ_CA_BUNDLE_PATH)) {
                    console.log(`[Diagnostic] Loading CA Bundle from: ${process.env.SEFAZ_CA_BUNDLE_PATH}`);
                    ca = fs.readFileSync(process.env.SEFAZ_CA_BUNDLE_PATH);
                }

                const strictSocket = tls.connect({
                    host: host,
                    port: port,
                    rejectUnauthorized: true,
                    servername: host,
                    ca: ca
                });

                strictSocket.on('secureConnect', () => {
                    console.log('[Diagnostic] Success: Connection allowed with default Node.js root store.');
                    strictSocket.end();
                });

                strictSocket.on('error', (err: any) => {
                    console.log(`[Diagnostic] Strict Connection Failed: ${err.message}`);
                    console.log(`[Diagnostic] Error Code: ${err.code}`);

                    if (err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
                        console.log('\n[Hint] The error UNABLE_TO_GET_ISSUER_CERT_LOCALLY indicates that a CA certificate (usually an intermediate) is missing.');
                        console.log('[Hint] Fix: You must obtain the ICP-Brasil v10 (or relevant) generic chain bundle and configure SEFAZ_CA_BUNDLE_PATH in your environment.');
                    }
                });

            } else {
                console.log('[Diagnostic] No certificate info received!');
            }

            socket.end();
        });

        socket.on('error', (err) => {
            console.error('[Diagnostic] Socket Error:', err);
        });

    } catch (e: any) {
        console.error('[Diagnostic] Fatal Error:', e.message);
    }
}

runDiagnostic();
