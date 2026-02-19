
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import https from 'https';
import { createAdminClient } from '../lib/supabaseServer';
import { loadCompanyCertificate } from '../lib/nfe/sefaz/services/certificateLoader';
import { soapRequest } from '../lib/nfe/sefaz/soap/soapClient';

// Setup environment for testing to mimic production if needed
// process.env.NODE_ENV = 'production'; 

async function main() {
    console.log('--- SEFAZ Connectivity Audit ---');
    console.log(`Node Version: ${process.version}`);
    console.log(`Platform: ${process.platform} (${process.arch})`);

    // 1. Audit CA Bundle
    const caPath = process.env.SEFAZ_CA_BUNDLE_PATH;
    console.log(`\n[Audit] SEFAZ_CA_BUNDLE_PATH: ${caPath || 'Not Set'}`);
    if (caPath) {
        const resolvedPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
        if (fs.existsSync(resolvedPath)) {
            const stats = fs.statSync(resolvedPath);
            console.log(`[PASS] CA Bundle found at ${resolvedPath} (${stats.size} bytes)`);
        } else {
            console.error(`[FAIL] CA Bundle configured but NOT FOUND at ${resolvedPath}`);
        }
    } else {
        console.warn(`[WARN] No CA Bundle configured. Relying on System Root Store. (May fail on Linux for ICP-Brasil)`);
    }

    // 2. Load Certificate
    const admin = createAdminClient();
    // Fetch a company to test with (any valid one)
    const { data: company, error } = await admin
        .from('companies')
        .select('id, name')
        .limit(1)
        .single();

    if (error || !company) {
        console.error('[FAIL] Could not fetch a company to test certificate loading.');
        return;
    }

    console.log(`\n[Audit] Testing Certificate Loading for: ${company.name} (${company.id})`);
    let certConfig;
    try {
        certConfig = await loadCompanyCertificate(company.id);
        console.log(`[PASS] Certificate loaded successfully.`);
    } catch (e: any) {
        console.error(`[FAIL] Certificate Load Error: ${e.message}`);
        return;
    }

    // 3. Test Connection (Status Service - lightweight, no xml signing needed usually, but we sign for auth)
    // Actually Status Service does NOT need signed XML, just SSL auth.
    // URL for SP Homologation
    const uf = 'SP';
    const tpAmb = '2'; // Homolog
    const url = 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeStatusServico4.asmx';
    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF';
    const xml = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${tpAmb}</tpAmb>
        <cUF>35</cUF>
        <xServ>STATUS</xServ>
    </consStatServ>`;

    // We need to wrap it in envelope manually since we are bypassing the service layer for raw audit
    const envelope = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
        <soap12:Header>
            <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
                <cUF>35</cUF>
                <versaoDados>4.00</versaoDados>
            </nfeCabecMsg>
        </soap12:Header>
        <soap12:Body>
            <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
                ${xml}
            </nfeDadosMsg>
        </soap12:Body>
    </soap12:Envelope>`;

    console.log(`\n[Audit] Testing SEFAZ Connection to ${url}...`);

    try {
        const { status, body } = await soapRequest(
            url,
            action,
            envelope,
            certConfig,
            { debug: true } // Enable debug logs
        );

        console.log(`[Result] Status: ${status}`);
        if (status === 200) {
            console.log(`[PASS] Connection Successful.`);
            const cStatMatch = body.match(/<cStat>(.*?)<\/cStat>/);
            const xMotivoMatch = body.match(/<xMotivo>(.*?)<\/xMotivo>/);
            console.log(`Service Status: ${cStatMatch?.[1]} - ${xMotivoMatch?.[1]}`);
        } else {
            console.error(`[FAIL] HTTP Error: ${status}`);
            console.log(body.slice(0, 500));
        }

    } catch (e: any) {
        console.error(`\n[FATAL] Connection Failed:`);
        console.error(`Error: ${e.message}`);
        if (e.code) console.error(`Code: ${e.code}`);
        if (e.details) console.log('Details:', JSON.stringify(e.details, null, 2));

        if (e.message.includes('UNABLE_TO_GET_ISSUER_CERT_LOCALLY')) {
            console.log('\n*** DIAGNOSIS ***');
            console.log('The server trusts only standard CAs. SEFAZ uses ICP-Brasil.');
            console.log('SOLUTION: You must set SEFAZ_CA_BUNDLE_PATH to a valid .pem file containing ICP-Brasil roots.');
        }
    }
}

main();
