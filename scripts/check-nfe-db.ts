import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseServer';

async function checkNfeStatus() {
    // Usando admin client para garantir acesso
    const supabase = createAdminClient();

    // Buscar a última emissão ou uma específica se tivesse ID
    // Aqui vou pegar as últimas 5 para garantir
    const { data: emissions, error } = await supabase
        .from('nfe_emissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Erro ao buscar emissões:", error);
        return;
    }

    console.log("=== ÚLTIMAS 5 EMISSÕES NF-E ===");
    emissions.forEach(e => {
        console.log(`\n----------------------------------------`);
        console.log(`ID: ${e.id}`);
        console.log(`Número: ${e.numero} | Série: ${e.serie}`);
        console.log(`Status: ${e.status}`);
        console.log(`Recibo (nRec): ${e.n_recibo || 'NÃO TEM'}`);
        console.log(`Chave: ${e.access_key}`);
        console.log(`Ambiente: ${e.tp_amb} (1=Prod, 2=Homolog)`);
        console.log(`Motivo (xMotivo): ${e.x_motivo}`);
        console.log(`XML Signed (tem?): ${!!e.xml_signed}`);
        console.log(`XML Proc (tem?): ${!!e.xml_nfe_proc}`);
        console.log(`Ultima atualização: ${e.updated_at}`);
    });
}

checkNfeStatus();
