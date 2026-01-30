
import fs from 'fs';
import path from 'path';
// import forge from 'node-forge'; // Use require to avoid issues if esm parsing fails
const forge = require('node-forge');
import { signNfeXml } from '../lib/nfe/sign/signNfeXml';

function generateTestPfx(): string {
    console.log('Generating temporary 2048-bit RSA keypair (this make take a second)...');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{
        name: 'commonName',
        value: 'Benchmark Test Cert'
    }, {
        name: 'countryName',
        value: 'BR'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Sign with own private key
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Create PFX
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], '123456');
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    return forge.util.encode64(p12Der);
}

async function runBenchmark() {
    try {
        const xmlPath = path.resolve('nfe.xml');
        if (!fs.existsSync(xmlPath)) {
            throw new Error('nfe.xml not found using path: ' + xmlPath);
        }

        let xmlContent = fs.readFileSync(xmlPath, 'utf8');
        xmlContent = xmlContent.replace(/<Signature[\s\S]*?<\/Signature>/g, '');

        if (!xmlContent.includes('Id="NFe')) {
            console.log('Injecting dummy Id into XML for testing...');
            xmlContent = xmlContent.replace('<infNFe', '<infNFe Id="NFe35230912345678901234550010000000011000000001"');
        }

        const pfxBase64 = generateTestPfx();
        const iterations = 100;
        console.log(`\n--- Starting Benchmark ---`);
        console.log(`Iterations: ${iterations}`);

        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            try {
                const result = signNfeXml(xmlContent, {
                    pfxBase64,
                    pfxPassword: '123456'
                });
                if (!result.signedXml) throw new Error('No signed XML returned');
                if (i % 10 === 0) process.stdout.write('.');
            } catch (err: any) {
                console.error(`\nError at iteration ${i}:`, err.message);
                process.exit(1);
            }
        }

        const end = performance.now();
        const totalTime = end - start;
        const avgTime = totalTime / iterations;

        console.log(`\n\n--- Results ---`);
        console.log(`Total Time: ${totalTime.toFixed(2)} ms`);
        console.log(`Avg Time per Sign: ${avgTime.toFixed(2)} ms`);
        console.log(`Throughput: ${(1000 / avgTime).toFixed(2)} ops/sec`);
        console.log(`Status: ${avgTime < 100 ? 'EXCELLENT (<100ms)' : avgTime < 500 ? 'ACCEPTABLE' : 'SLOW'}`);

    } catch (err: any) {
        console.error('Benchmark failed:', err);
    }
}

runBenchmark();
