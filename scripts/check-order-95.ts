import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder95() {
    console.log('🔍 Investigating Order #95\n');

    // Get order #95
    const { data: order } = await supabase
        .from('sales_documents')
        .select('id, document_number, created_at')
        .eq('document_number', 95)
        .single();

    if (!order) {
        console.log('❌ Order #95 not found');
        return;
    }

    console.log('📋 Order Info:');
    console.log('  ID:', order.id);
    console.log('  Created:', order.created_at);

    // Check NFe emission attempts
    const { data: emissions } = await supabase
        .from('nfe_emissions')
        .select('*')
        .eq('sales_document_id', order.id)
        .order('created_at', { ascending: false });

    if (!emissions || emissions.length === 0) {
        console.log('\n⚠️  No NFe emission attempts found for this order');
        return;
    }

    console.log(`\n📡 Found ${emissions.length} emission attempt(s):`);

    emissions.forEach((emission: any, idx) => {
        console.log(`\n  Attempt ${idx + 1}:`);
        console.log('    ID:', emission.id);
        console.log('    Status:', emission.status);
        console.log('    Created:', emission.created_at);
        console.log('    Updated:', emission.updated_at);

        if (emission.rejection_code) {
            console.log('    ❌ Rejection Code:', emission.rejection_code);
            console.log('    ❌ Rejection Message:', emission.rejection_message);
        }

        if (emission.protocol_number) {
            console.log('    ✅ Protocol:', emission.protocol_number);
        }

        if (emission.authorization_xml) {
            console.log('    Has authorization XML: Yes');
        }

        if (emission.sefaz_response_xml) {
            const responseXml = emission.sefaz_response_xml;

            // Extract status codes from response
            const statMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/g);
            const motivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/g);

            if (statMatch && motivoMatch) {
                console.log('\n    📄 SEFAZ Response:');
                statMatch.forEach((stat: string, i: number) => {
                    const code = stat.match(/\d+/)?.[0];
                    const motivo = motivoMatch[i]?.match(/>([^<]+)</)?.[1];
                    console.log(`      Status ${code}: ${motivo}`);
                });
            }
        }
    });

    // Check debug files
    console.log('\n📁 Checking debug files...');
    const debugDir = '/tmp/desdobra-sefaz';

    if (fs.existsSync(debugDir)) {
        const files = fs.readdirSync(debugDir)
            .filter(f => f.endsWith('.request.soap.xml'))
            .sort()
            .reverse()
            .slice(0, 5);

        console.log(`Found ${files.length} recent request files`);

        // Check if any contains order #95 data
        for (const file of files) {
            const content = fs.readFileSync(path.join(debugDir, file), 'utf-8');
            if (content.includes('DCF45') || content.includes(order.id)) {
                console.log(`\n  Potential match: ${file}`);

                // Check corresponding response
                const responseFile = file.replace('.request.soap.xml', '.response.soap.xml');
                const responsePath = path.join(debugDir, responseFile);

                if (fs.existsSync(responsePath)) {
                    const response = fs.readFileSync(responsePath, 'utf-8');
                    const statMatch = response.match(/<cStat>(\d+)<\/cStat>/g);
                    const motivoMatch = response.match(/<xMotivo>([^<]+)<\/xMotivo>/g);

                    if (statMatch) {
                        console.log('  Response statuses:');
                        statMatch.forEach((stat: string, i: number) => {
                            const code = stat.match(/\d+/)?.[0];
                            const motivo = motivoMatch?.[i]?.match(/>([^<]+)</)?.[1] || 'N/A';
                            console.log(`    ${code}: ${motivo}`);
                        });
                    }
                }
            }
        }
    }
}

checkOrder95().catch(console.error);
