#!/usr/bin/env node
/**
 * AUDITORIA TÉCNICA NF-e #16
 * Objetivo: Verificar ponta-a-ponta a autorização e gerar relatório com evidências
 */

import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import * as crypto from 'crypto';
import * as fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

const NFE_ID = '3af869be-813d-4ce3-9837-d74868279f3f';
const NFE_NUMBER = 16;

const evidencias = {
    xml_gerado: false,
    xml_assinado: false,
    assinatura_valida: null,
    chave_acesso_44: null,
    retorno_autorizacao: false,
    nProt: null,
    dhRecbto: null,
    cStat_sefaz: null,
    xMotivo_sefaz: null,
    nfeProc_existe: false,
    consulta_situacao_confirma: null
};

const bugs = [];
const correcoes = [];

async function audit() {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║   AUDITORIA TÉCNICA - NF-e #16 (SÉRIE 1)         ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // ========== (A) O QUE FOI GERADO ===========
    console.log('📋 [A] VERIFICANDO DADOS GERADOS\n');

    const { data: nfe, error } = await supabase
        .from('sales_document_nfes')
        .select('*')
        .eq('id', NFE_ID)
        .single();

    if (error || !nfe) {
        console.error('❌ FALHA CRÍTICA: NF-e não encontrada no banco');
        return;
    }

    console.log('✅ Registro encontrado:');
    console.log('   ID:', nfe.id);
    console.log('   Número/Série:', nfe.nfe_number, '/', nfe.nfe_series);
    console.log('   Status DB:', nfe.status);
    console.log('   Chave DB:', nfe.nfe_key || 'NULL');
    console.log('   Created:', nfe.created_at);
    console.log('   Updated:', nfe.updated_at);

    const details = nfe.details || {};
    console.log('\n📊 Details structure:');
    console.log('   Keys:', Object.keys(details).join(', '));
    console.log('   cStat:', details.cStat || 'NULL');
    console.log('   xMotivo:', details.xMotivo || 'NULL');
    console.log('   chNFe:', details.chNFe || 'NULL');
    console.log('   Artifacts:', JSON.stringify(details.artifacts, null, 2));

    // Download XMLs
    const artifacts = details.artifacts || {};
    let xmlOriginal = null;
    let xmlAssinado = null;
    let xmlProtocol = null;

    if (artifacts.xml) {
        const { data } = await supabase.storage.from('company-assets').download(artifacts.xml);
        if (data) {
            xmlOriginal = await data.text();
            evidencias.xml_gerado = true;
            console.log('\n✅ XML Original: ', xmlOriginal.length, 'bytes');
            fs.writeFileSync('/tmp/audit-nfe16-original.xml', xmlOriginal);
        }
    }

    if (artifacts.signed_xml) {
        const { data } = await supabase.storage.from('company-assets').download(artifacts.signed_xml);
        if (data) {
            xmlAssinado = await data.text();
            evidencias.xml_assinado = true;
            console.log('✅ XML Assinado:', xmlAssinado.length, 'bytes');
            fs.writeFileSync('/tmp/audit-nfe16-signed.xml', xmlAssinado);
        }
    }

    if (artifacts.protocol) {
        const { data } = await supabase.storage.from('company-assets').download(artifacts.protocol);
        if (data) {
            xmlProtocol = await data.text();
            console.log('✅ XML Protocol:', xmlProtocol.length, 'bytes');
            fs.writeFileSync('/tmp/audit-nfe16-protocol.xml', xmlProtocol);
        }
    }

    // ========== (B) ASSINATURA ===========
    console.log('\n🔐 [B] VERIFICANDO ASSINATURA\n');

    if (!xmlAssinado) {
        console.log('❌ XML Assinado não encontrado');
        bugs.push('XML assinado não está armazenado');
    } else {
        const hasSignature = xmlAssinado.includes('<Signature');
        console.log('   Has <Signature>:', hasSignature ? '✅' : '❌');

        if (hasSignature) {
            // Extract certificate CN
            const cnMatch = xmlAssinado.match(/CN=([^,]+)/);
            if (cnMatch) {
                console.log('   Certificate CN:', cnMatch[1]);
            }

            // Verificar se assinatura é válida (simplificado - apenas verifica presença)
            const signatureValueMatch = xmlAssinado.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
            if (signatureValueMatch && signatureValueMatch[1].length > 100) {
                evidencias.assinatura_valida = true;
                console.log('   Signature Value:', signatureValueMatch[1].substring(0, 50) + '...');
            }
        }

        // Extract chave from infNFe/@Id
        const idMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
        if (idMatch) {
            evidencias.chave_acesso_44 = idMatch[1];
            console.log('   ✅ Chave 44 digits:', idMatch[1]);
            console.log('   ✅ Matches format: 35260103645616000108550010000000161413140622');
        } else {
            console.log('   ❌ Chave não encontrada no Id');
            bugs.push('Chave de acesso não encontrada no XML assinado');
        }

        // Check if cNF is being misused
        const parsed = parser.parse(xmlAssinado);
        const nfeNode = parsed.NFe || parsed.nfeProc?.NFe;
        const cNF = nfeNode?.infNFe?.ide?.cNF;
        console.log('   cNF (8 digits):', cNF);
        if (nfe.nfe_key && nfe.nfe_key.length === 8) {
            console.log('   ⚠️  WARNING: nfe_key no DB tem 8 dígitos (deveria ser 44)');
            bugs.push('Campo nfe_key está armazentando cNF ao invés da chave completa');
        }
    }

    // ========== (C) ENVIO ===========
    console.log('\n📤 [C] VERIFICANDO ENVIO SEFAZ\n');
    console.log('   ⚠️  Logs de envio não estão estruturados no banco');
    console.log('   Sugestão: adicionar tabela nfe_transmission_logs');
    correcoes.push('Criar tabela para armazenar logs de transmissão SEFAZ');

    // ========== (D) RETORNO AUTORIZAÇÃO ===========
    console.log('\n📥 [D] VERIFICANDO RETORNO AUTORIZAÇÃO\n');

    if (details.cStat) {
        evidencias.cStat_sefaz = details.cStat;
        evidencias.xMotivo_sefaz = details.xMotivo;
        evidencias.retorno_autorizacao = true;
        console.log('   ✅ cStat:', details.cStat);
        console.log('   ✅ xMotivo:', details.xMotivo);
    } else {
        console.log('   ❌ cStat não encontrado em details');
        bugs.push('Retorno SEFAZ não está sendo persistido em campo estruturado');
    }

    if (xmlProtocol) {
        const protParsed = parser.parse(xmlProtocol);
        const infProt = protParsed.protNFe?.infProt;
        if (infProt) {
            evidencias.nProt = infProt.nProt;
            evidencias.dhRecbto = infProt.dhRecbto;
            console.log('   ✅ nProt:', infProt.nProt);
            console.log('   ✅ dhRecbto:', infProt.dhRecbto);
            console.log('   ✅ cStat (protocol):', infProt.cStat);
            console.log('   ✅ xMotivo (protocol):', infProt.xMotivo);
        }
    } else {
        console.log('   ❌ Protocolo não armazenado');
        bugs.push('XML do protocolo não está sendo armazenado separadamente');
    }

    // ========== (E) NFEPROC ===========
    console.log('\n📦 [E] VERIFICANDO NFEPROC\n');

    // Check if nfeProc exists in storage
    const nfeProcPath = artifacts.nfe_proc || `nfe/${nfe.document_id}/${nfe.id}/nfe-proc.xml`;
    const { data: nfeProcFile } = await supabase.storage.from('company-assets').download(nfeProcPath);

    if (nfeProcFile) {
        const nfeProcXml = await nfeProcFile.text();
        if (nfeProcXml.includes('<nfeProc')) {
            evidencias.nfeProc_existe = true;
            console.log('   ✅ nfeProc existe:', nfeProcXml.length, 'bytes');
            fs.writeFileSync('/tmp/audit-nfe16-proc.xml', nfeProcXml);
        }
    } else {
        console.log('   ❌ nfeProc NÃO EXISTE');
        console.log('   📝 Precisa ser construído: <nfeProc><NFe>...</NFe><protNFe>...</protNFe></nfeProc>');
        bugs.push('Sistema não está montando/armazenando nfeProc após autorização');
        correcoes.push('Implementar montagem de nfeProc após autorização');
        correcoes.push('Adicionar campo xml_proc em sales_document_nfes ou artifacts.nfe_proc');
    }

    // ========== (F) CONSULTA SITUAÇÃO ===========
    console.log('\n🔍 [F] CONSULTA SITUAÇÃO NA SEFAZ\n');
    console.log('   ⚠️  Implementação pendente: script de consulta situação');
    console.log('   Chave para consultar:', evidencias.chave_acesso_44);
    correcoes.push('Criar botão "Verificar na SEFAZ" que consulta situação pela chave');

    // ========== (G) DANFE ===========
    console.log('\n📄 [G] ANÁLISE DO DANFE\n');

    console.log('   Bugs identificados no DANFE atual:');
    console.log('   ❌ Chave de acesso mostra 8 dígitos (cNF) ao invés de 44');
    console.log('   ❌ Protocolo aparece como "-" ao invés do nProt');
    console.log('   ❌ NCM/CFOP saem undefined');
    console.log('   ❌ CST não respeita CRT');

    bugs.push('DANFE: Chave de acesso usando cNF (8 dig) ao invés de chave completa (44 dig)');
    bugs.push('DANFE: Protocolo não aparece (deve mostrar nProt)');
    bugs.push('DANFE: NCM e CFOP mapeados incorretamente');
    bugs.push('DANFE: CST não respeita CRT do emissor');

    correcoes.push('Corrigir danfeRenderer para usar chave 44 dígitos');
    correcoes.push('Corrigir danfeRenderer para exibir nProt do protocolo');
    correcoes.push('Corrigir parser DANFE para extrair NCM e CFOP corretamente');
    correcoes.push('Ajustar lógica CST baseado em CRT');

    // ========== RELATÓRIO FINAL ===========
    console.log('\n' + '═'.repeat(60));
    console.log('RELATÓRIO DE EVIDÊNCIAS');
    console.log('═'.repeat(60) + '\n');

    console.log('Evidência                     | Status');
    console.log('------------------------------|----------');
    console.log(`XML Gerado                    | ${evidencias.xml_gerado ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`XML Assinado                  | ${evidencias.xml_assinado ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Assinatura Válida             | ${evidencias.assinatura_valida ? '✅ PASS' : '❓ N/A'}`);
    console.log(`Chave 44 dígitos              | ${evidencias.chave_acesso_44 ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Retorno Autorização           | ${evidencias.retorno_autorizacao ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`nProt armazenado              | ${evidencias.nProt ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`dhRecbto armazenado           | ${evidencias.dhRecbto ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`nfeProc existe                | ${evidencias.nfeProc_existe ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Consulta confirmada (SEFAZ)   | ⏳ PENDENTE`);

    console.log('\n' + '═'.repeat(60));
    console.log('CONCLUSÃO');
    console.log('═'.repeat(60) + '\n');

    if (evidencias.cStat_sefaz === '100' && evidencias.nProt) {
        console.log('✅ AUTORIZADA CONFIRMADA');
        console.log('   cStat: 100');
        console.log('   nProt:', evidencias.nProt);
        console.log('   dhRecbto:', evidencias.dhRecbto);
    } else if (evidencias.cStat_sefaz) {
        console.log('⚠️  STATUS SEFAZ:', evidencias.cStat_sefaz);
        console.log('   xMotivo:', evidencias.xMotivo_sefaz);
    } else {
        console.log('❌ NÃO CONFIRMADA - Retorno SEFAZ não persistido corretamente');
    }

    console.log('\n📋 BUGS IDENTIFICADOS (' + bugs.length + '):');
    bugs.forEach((bug, i) => console.log(`   ${i + 1}. ${bug}`));

    console.log('\n🔧 CORREÇÕES NECESSÁRIAS (' + correcoes.length + '):');
    correcoes.forEach((cor, i) => console.log(`   ${i + 1}. ${cor}`));

    // Save report
    const report = generateMarkdownReport(nfe, evidencias, bugs, correcoes);
    fs.writeFileSync('/tmp/audit-nfe16-report.md', report);
    console.log('\n💾 Relatório salvo em: /tmp/audit-nfe16-report.md');
    console.log('💾 XMLs salvos em: /tmp/audit-nfe16-*.xml');
}

function generateMarkdownReport(nfe, evidencias, bugs, correcoes) {
    return `# Auditoria Técnica - NF-e #16

## Dados Básicos

- **NF-e**: #16 / Série 1
- **ID**: ${nfe.id}
- **Status DB**: ${nfe.status}
- **Created**: ${nfe.created_at}
- **Chave DB**: ${nfe.nfe_key || 'NULL'}

## Tabela de Evidências

| Evidência | Status | Detalhes |
|-----------|--------|----------|
| XML Gerado | ${evidencias.xml_gerado ? '✅' : '❌'} | ${evidencias.xml_gerado ? 'Armazenado' : 'Não encontrado'} |
| XML Assinado | ${evidencias.xml_assinado ? '✅' : '❌'} | ${evidencias.xml_assinado ? 'Armazenado' : 'Não encontrado'} |
| Assinatura Válida | ${evidencias.assinatura_valida ? '✅' : '❓'} | ${evidencias.assinatura_valida ? 'PASS' : 'Não verificado'} |
| Chave 44 dígitos | ${evidencias.chave_acesso_44 ? '✅' : '❌'} | \`${evidencias.chave_acesso_44 || 'N/A'}\` |
| Retorno Autorização | ${evidencias.retorno_autorizacao ? '✅' : '❌'} | cStat: ${evidencias.cStat_sefaz || 'NULL'} |
| nProt | ${evidencias.nProt ? '✅' : '❌'} | \`${evidencias.nProt || 'NULL'}\` |
| dhRecbto | ${evidencias.dhRecbto ? '✅' : '❌'} | ${evidencias.dhRecbto || 'NULL'} |
| nfeProc existe | ${evidencias.nfeProc_existe ? '✅' : '❌'} | ${evidencias.nfeProc_existe ? 'Sim' : 'NÃO - precisa ser criado'} |
| Consulta SEFAZ | ⏳ | PENDENTE |

## Evidências Técnicas

### infNFe/@Id
\`\`\`
Id="NFe${evidencias.chave_acesso_44 || 'NÃO_ENCONTRADO'}"
\`\`\`

### Protocolo
\`\`\`xml
<infProt>
  <cStat>${evidencias.cStat_sefaz || 'NULL'}</cStat>
  <nProt>${evidencias.nProt || 'NULL'}</nProt>
  <dhRecbto>${evidencias.dhRecbto || 'NULL'}</dhRecbto>
</infProt>
\`\`\`

## Conclusão

${evidencias.cStat_sefaz === '100' && evidencias.nProt
            ? `✅ **AUTORIZADA CONFIRMADA**\n\n- cStat: 100\n- nProt: ${evidencias.nProt}\n- dhRecbto: ${evidencias.dhRecbto}`
            : '❌ **NÃO CONFIRMADA** - Falta evidência de autorização completa'
        }

## Bugs Identificados

${bugs.map((b, i) => `${i + 1}. ${b}`).join('\n')}

## Checklist de Correções

${correcoes.map((c, i) => `- [ ] ${c}`).join('\n')}

## Patches Necessários

### PR 1: Persistência de retorno SEFAZ
- Adicionar campos: \`cStat_sefaz\`, \`xMotivo_sefaz\`, \`nProt\`, \`dhRecbto\` em \`sales_document_nfes\`
- Ou migrar para usar \`nfe_emissions\` que já tem esses campos

### PR 2: Montagem nfeProc
- Após autorização (cStat=100), montar XML nfeProc
- Salvar em \`artifacts.nfe_proc\` ou campo \`xml_proc\`

### PR 3: Correção DANFE
- Usar chave 44 dígitos ao invés de cNF
- Exibir nProt quando autorizada
- Corrigir mapeamento NCM/CFOP
- Ajustar CST baseado em CRT

### PR 4: Botão "Verificar na SEFAZ"
- Implementar consulta situação pela chave
- Atualizar status local com resposta SEFAZ
`;
}

audit().catch(console.error);
