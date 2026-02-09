import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditLogoipeline() {
    console.log('=== AUDITORIA COMPLETA - PIPELINE DE LOGO ===\n');

    // 1. Verificar company_settings
    console.log('1️⃣ COMPANY_SETTINGS:');
    const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('*')
        .single();

    if (settingsError) {
        console.log('   ❌ Erro:', settingsError.message);
        return;
    }

    console.log('   ✅ Registro encontrado');
    console.log('   logo_path:', settings.logo_path || 'NULL');
    console.log('   Campos disponíveis:', Object.keys(settings).join(', '));

    if (!settings.logo_path) {
        console.log('\n   ⚠️  PROBLEMA ENCONTRADO: logo_path está NULL!');
        return;
    }

    // 2. Testar URL do logo
    console.log('\n2️⃣ TESTE DE URL:');
    console.log('   URL:', settings.logo_path);

    try {
        const response = await fetch(settings.logo_path);
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        console.log('   Content-Length:', response.headers.get('content-length'), 'bytes');

        if (!response.ok) {
            console.log('   ❌ URL não acessível!');
            return;
        }

        console.log('   ✅ URL acessível');
    } catch (error: any) {
        console.log('   ❌ Erro ao acessar URL:', error.message);
        return;
    }

    // 3. Verificar NFe record
    console.log('\n3️⃣ NFE RECORD:');
    const nfeId = '3af869be-813d-4ce3-9837-d74868279f3f';

    const { data: nfe, error: nfeError } = await supabase
        .from('sales_document_nfes')
        .select('id, document_id, nfe_key')
        .eq('id', nfeId)
        .single();

    if (nfeError) {
        console.log('   ❌ Erro:', nfeError.message);
        return;
    }

    console.log('   ✅ NFe encontrada');
    console.log('   document_id:', nfe.document_id);

    // 4. Verificar sales_document
    console.log('\n4️⃣ SALES_DOCUMENT (para company_id):');
    const { data: doc, error: docError } = await supabase
        .from('sales_documents')
        .select('id, company_id')
        .eq('id', nfe.document_id)
        .single();

    if (docError) {
        console.log('   ❌ Erro:', docError.message);
        return;
    }

    console.log('   ✅ Document encontrado');
    console.log('   company_id:', doc.company_id);

    // 5. Simular conversão para base64
    console.log('\n5️⃣ TESTE DE CONVERSÃO BASE64:');
    try {
        const response = await fetch(settings.logo_path);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        const dataUri = `data:${contentType};base64,${base64}`;

        console.log('   ✅ Conversão bem-sucedida');
        console.log('   Base64 size:', Math.round(base64.length / 1024), 'KB');
        console.log('   Data URI prefix:', dataUri.substring(0, 50) + '...');
    } catch (error: any) {
        console.log('   ❌ Erro na conversão:', error.message);
        return;
    }

    console.log('\n=== RESUMO ===');
    console.log('✅ company_settings.logo_path existe');
    console.log('✅ URL do logo é acessível');
    console.log('✅ company_id está disponível');
    console.log('✅ Conversão base64 funciona');
    console.log('\n🔍 PRÓXIMO PASSO: Verificar logs do servidor durante geração do DANFE');
}

auditLogoipeline().catch(console.error);
