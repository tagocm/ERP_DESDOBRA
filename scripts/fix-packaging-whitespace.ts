import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log('🔧 Corrigindo labels com espaços em branco...\n');

    // Find all packaging with trailing spaces
    const { data: packaging } = await supabase
        .from('item_packaging')
        .select('id, label, type')
        .or('label.like.% ,type.like.% ');

    console.log(`Encontrados ${packaging?.length || 0} registros com espaços`);

    if (packaging && packaging.length > 0) {
        for (const pkg of packaging) {
            const fixed = {
                label: pkg.label?.trim(),
                type: pkg.type?.trim()
            };

            console.log(`  Corrigindo ID ${pkg.id}: "${pkg.label}" -> "${fixed.label}"`);

            await supabase
                .from('item_packaging')
                .update(fixed)
                .eq('id', pkg.id);
        }
    }

    console.log('\n✅ Concluído!');
}

fix();
