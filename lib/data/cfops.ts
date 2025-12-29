
import { SupabaseClient } from "@supabase/supabase-js";

export interface Cfop {
    id: string;
    codigo: string;
    descricao: string;
    tipo_operacao: 'entrada' | 'saida';
    ambito: 'estadual' | 'interestadual' | 'exterior';
    ativo: boolean;
}

export async function getCfops(supabase: SupabaseClient) {
    const { data, error } = await supabase
        .from('cfop')
        .select('*')
        .eq('ativo', true)
        .order('codigo', { ascending: true });

    if (error) {
        console.error('Error fetching CFOPs:', error);
        return [];
    }

    return data as Cfop[];
}
