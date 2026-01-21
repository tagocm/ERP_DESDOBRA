import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanWhitespace() {
    console.log('🧹 Limpando espaços em branco nas embalagens...\n');

    // Get all packaging
    const { data: allPackaging } = await supabase
        .from('item_packaging')
        .select('id, label, type');

    if (!allPackaging) {
        console.log('Nenhuma embalagem encontrada');
        return;
    }

    console.log(`Total de registros: ${allPackaging.length}`);

    let fixed = 0;

    for (const pkg of allPackaging) {
        const originalLabel = pkg.label;
        const originalType = pkg.type;
        const trimmedLabel = pkg.label?.trim();
        const trimmedType = pkg.type?.trim();

        if (originalLabel !== trimmedLabel || originalType !== trimmedType) {
            fixed++;
            console.log(`  Corrigindo ID ${pkg.id}:`);
            if (originalLabel !== trimmedLabel) {
                console.log(`    label: "${originalLabel}" -> "${trimmedLabel}"`);
            }
            if (originalType !== trimmedType) {
                console.log(`    type: "${originalType}" -> "${trimmedType}"`);
            }

            const { error } = await supabase
                .from('item_packaging')
                .update({
                    label: trimmedLabel,
                    type: trimmedType
                })
                .eq('id', pkg.id);

            if (error) {
                console.error(`    ❌ Erro: ${error.message}`);
            } else {
                console.log(`    ✅ Atualizado`);
            }
        }
    }

    console.log(`\n✅ Concluído! ${fixed} registros corrigidos de ${allPackaging.length} totais.`);
}

cleanWhitespace();
