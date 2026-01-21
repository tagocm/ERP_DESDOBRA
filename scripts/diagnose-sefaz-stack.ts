
import fs from 'fs';
import https from 'https';
import tls from 'tls';
import path from 'path';
import { soapRequest } from '../lib/nfe/sefaz/soap/soapClient'; // Adjust path if needed

// Configuration
const SEFAZ_URL = "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx";
const BUNDLE_PATH = process.env.SEFAZ_CA_BUNDLE_PATH;

console.log(`\n=== SEFAZ DIAGNOSTIC STACK ===`);
console.log(`Time: ${new Date().toISOString()}`);
console.log(`Node: ${process.version}`);
console.log(`Target: ${SEFAZ_URL}`);
console.log(`Bundle Path (Env): ${BUNDLE_PATH || 'Not set'}`);

async function checks() {
    // 1. Validate Bundle File
    console.log(`\n[1] Checking CA Bundle File...`);
    let caContent: Buffer | undefined;
    if (BUNDLE_PATH) {
        const resolvedPath = path.resolve(process.cwd(), BUNDLE_PATH);
        if (fs.existsSync(resolvedPath)) {
            const stats = fs.statSync(resolvedPath);
            caContent = fs.readFileSync(resolvedPath);
            console.log(`PASS: File exists at ${resolvedPath}`);
            console.log(`Info: Size=${stats.size} bytes`);

            const lines = caContent.toString().split('\n').filter(l => l.trim().length > 0);
            console.log(`Preview: ${lines[0]} ... ${lines[lines.length - 1]}`);
        } else {
            console.error(`FAIL: File not found at ${resolvedPath}`);
        }
    } else {
        console.warn(`WARN: SEFAZ_CA_BUNDLE_PATH not set. Relying on NODE_EXTRA_CA_CERTS or system defaults.`);
    }

    // 2. TLS Handshake (Raw)
    console.log(`\n[2] Testing TLS Handshake (Strict Mode)...`);
    try {
        const u = new URL(SEFAZ_URL);
        const options: tls.ConnectionOptions = {
            host: u.hostname,
            port: parseInt(u.port || '443'),
            servername: u.hostname,
            rejectUnauthorized: true,
            ca: caContent
        };

        await new Promise<void>((resolve, reject) => {
            const socket = tls.connect(options, () => {
                console.log(`PASS: Connected! Cipher=${socket.getCipher().name} Protocol=${socket.getProtocol()}`);
                console.log(`Server Cert Subject: ${socket.getPeerCertificate().subject.CN}`);
                console.log(`Server Cert Issuer: ${socket.getPeerCertificate().issuer.CN}`);
                socket.end();
                resolve();
            });
            socket.on('error', (err) => reject(err));
        });

    } catch (err: any) {
        console.error(`FAIL: TLS Handshake failed: ${err.message} (${err.code})`);
        if (err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
            console.error('HINT: This confirms the CA bundle is missing or incorrect for the chain.');
        }
    }

    // 3. HTTP Request (No Client Cert - Expect 403 or handshake success)
    console.log(`\n[3] Testing HTTP Request (Agent Configuration)...`);
    try {
        const agent = new https.Agent({
            keepAlive: true,
            rejectUnauthorized: true,
            ca: caContent
        });

        await new Promise<void>((resolve, reject) => {
            const req = https.request(SEFAZ_URL, {
                method: 'GET',
                agent: agent,
                timeout: 10000
            }, (res) => {
                console.log(`PASS: HTTP Response received! Status=${res.statusCode}`);
                // SEFAZ usually returns 403 Forbidden if client cert is missing, which is GOOD for TLS verification (it means TLS worked)
                if (res.statusCode === 403) {
                    console.log('Info: 403 Forbidden is expected (missing client cert), but confirms TLS is working.');
                }
                res.resume(); // consume
                resolve();
            });
            req.on('error', (err) => reject(err));
            req.end();
        });

    } catch (err: any) {
        console.error(`FAIL: HTTP Request failed: ${err.message}`);
    }

    // 4. Client Simulation (Mocking soapClient call if possible, or just informing)
    console.log(`\n[4] SOAP Client Logic Check...`);
    console.log(`Info: To test the FULL SOAP stack, run the app with 'npm run dev:sefaz' and trigger a query.`);
    console.log(`Info: The 'soapClient.ts' has been instrumented to log the exact Agent configuration used.`);

}

checks().catch(e => console.error(e));
