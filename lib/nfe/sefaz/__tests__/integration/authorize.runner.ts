/**
 * Integration Test Runner for NF-e Authorization
 * 
 * This script tests the full NF-e authorization flow in SEFAZ homologation (tpAmb=2).
 * 
 * PREREQUISITES:
 * 1. Valid A1 certificate (.pfx) with password
 * 2. Certificate credentialed in SEFAZ-SP homologation
 * 3. Environment variables configured (see below)
 * 
 * USAGE:
 *   npx tsx lib/nfe/sefaz/__tests__/integration/authorize.runner.ts
 * 
 * ENVIRONMENT VARIABLES:
 *   NFE_TEST_PFX_PATH=/path/to/cert.pfx
 *   NFE_TEST_PFX_PASSWORD=your_password
 *   NFE_TEST_COMPANY_ID=uuid
 *   NFE_WS_DEBUG=1 (optional, enables debug logs)
 */

import { emitirNfeHomolog } from '../../services/emitir';
import { NfeDraft } from '../../../domain/types';
import fs from 'fs';
import path from 'path';

async function runIntegrationTest() {
    console.log('\n=== NF-e Authorization Integration Test ===\n');

    // 1. Check environment
    const pfxPath = process.env.NFE_TEST_PFX_PATH;
    const pfxPassword = process.env.NFE_TEST_PFX_PASSWORD;
    const companyId = process.env.NFE_TEST_COMPANY_ID;

    if (!pfxPath || !pfxPassword) {
        console.error('❌ Missing environment variables:');
        console.error('   NFE_TEST_PFX_PATH=/path/to/cert.pfx');
        console.error('   NFE_TEST_PFX_PASSWORD=your_password');
        console.error('   NFE_TEST_COMPANY_ID=uuid (optional)');
        process.exit(1);
    }

    if (!fs.existsSync(pfxPath)) {
        console.error(`❌ Certificate file not found: ${pfxPath}`);
        process.exit(1);
    }

    console.log(`✓ Certificate: ${path.basename(pfxPath)}`);
    console.log(`✓ Password: ${'*'.repeat(pfxPassword.length)}`);
    console.log(`✓ Debug: ${process.env.NFE_WS_DEBUG === '1' ? 'ENABLED' : 'DISABLED'}`);

    // 2. Load Certificate
    const pfxBuffer = fs.readFileSync(pfxPath);
    const pfxBase64 = pfxBuffer.toString('base64');

    // 3. Build Test NF-e Draft
    const idLote = Date.now().toString().slice(-15);

    // Minimal valid NF-e for homologation
    const draft: NfeDraft = {
        ide: {
            cUF: '35',
            natOp: 'VENDA TESTE HOMOLOGACAO',
            mod: '55',
            serie: '1',
            nNF: '1',
            dhEmi: new Date().toISOString(),
            tpNF: '1',
            idDest: '1',
            cMunFG: '3550308', // São Paulo
            tpImp: '1',
            tpEmis: '1',
            tpAmb: '2', // HOMOLOGAÇÃO
            finNFe: '1',
            indFinal: '1',
            indPres: '1',
            procEmi: '0',
            verProc: 'Desdobra 1.0',
            chNFe: '' // Will be generated
        },
        emit: {
            cnpj: '',  // CONFIGURE with your  CNPJ
            xNome: '',  // CONFIGURE with your company name
            ie: '',     // CONFIGURE with your IE
            crt: '1',   // CONFIGURE: 1=Simples, 3=Normal
            enderEmit: {
                xLgr: 'Rua Teste',
                nro: '100',
                xBairro: 'Centro',
                cMun: '3550308',
                xMun: 'Sao Paulo',
                uf: 'SP',
                cep: '01001000'
            }
        },
        dest: {
            cpfOuCnpj: '99999999000191', // NF-e Consumidor Final (homolog)
            xNome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
            indIEDest: '9',
            enderDest: {
                xLgr: 'Rua Teste',
                nro: '1',
                xBairro: 'Centro',
                cMun: '3550308',
                xMun: 'Sao Paulo',
                uf: 'SP',
                cep: '01001000'
            }
        },
        itens: [{
            nItem: 1,
            prod: {
                cProd: 'PROD001',
                xProd: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
                ncm: '12345678',
                cfop: '5102',
                uCom: 'UN',
                qCom: 1,
                vUnCom: 100.00,
                vProd: 100.00,
                cean: 'SEM GTIN',
                ceanTrib: 'SEM GTIN',
                uTrib: 'UN',
                qTrib: 1,
                vUnTrib: 100.00
            },
            imposto: {
                icms: {
                    orig: '0',
                    csosn: '102' // Simples Nacional
                },
                pis: {
                    cst: '07'
                },
                cofins: {
                    cst: '07'
                }
            }
        }],
        pag: {
            detPag: [{
                tPag: '01',
                vPag: 100.00
            }]
        }
    };

    console.log(`\n📝 Draft NF-e:`);
    console.log(`   Lote: ${idLote}`);
    console.log(`   Série: ${draft.ide.serie} | Número: ${draft.ide.nNF}`);
    console.log(`\n⏳ Sending to SEFAZ homologation...\n`);

    // 4. Run Authorization
    try {
        const result = await emitirNfeHomolog(
            draft,
            { pfxBase64, pfxPassword },
            idLote,
            { debug: process.env.NFE_WS_DEBUG === '1' }
        );

        console.log('\n=== RESULT ===\n');
        console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
        console.log(`cStat: ${result.cStat}`);
        console.log(`xMotivo: ${result.xMotivo}`);

        if (result.success && result.protNFeXml) {
            const outputDir = '/tmp/desdobra-nfe-test';
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const timestamp = Date.now();
            fs.writeFileSync(`${outputDir}/${timestamp}-nfe-signed.xml`, result.nfeXmlAssinado);
            fs.writeFileSync(`${outputDir}/${timestamp}-prot.xml`, result.protNFeXml);

            console.log(`\n📄 Files saved to: ${outputDir}/`);
        }

        console.log(`\n=== LOGS ===\n`);
        result.logs.forEach((log, i) => console.log(`${i + 1}. ${log}`));

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        if (error.context) {
            console.error('Context:', JSON.stringify(error.context, null, 2));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    runIntegrationTest().catch(console.error);
}
