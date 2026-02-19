
import fs from "fs";
import path from "path";
import { SupabaseClient } from "@supabase/supabase-js";

import { CfopDTO } from "@/lib/types/fiscal-types";
export type { CfopDTO };

let cachedSefazCfops: CfopDTO[] | null = null;

function inferTipoOperacao(codigo: string): "entrada" | "saida" | null {
    const first = Number(codigo[0]);
    if ([1, 2, 3].includes(first)) return "entrada";
    if ([5, 6, 7].includes(first)) return "saida";
    return null;
}

function inferAmbito(codigo: string): "estadual" | "interestadual" | "exterior" | null {
    const first = Number(codigo[0]);
    if ([1, 5].includes(first)) return "estadual";
    if ([2, 6].includes(first)) return "interestadual";
    if ([3, 7].includes(first)) return "exterior";
    return null;
}

function loadSefazCfopsFromCsv(): CfopDTO[] {
    if (cachedSefazCfops) return cachedSefazCfops;

    const csvPath = path.join(process.cwd(), "data/seeds/cfop.csv");
    if (!fs.existsSync(csvPath)) {
        cachedSefazCfops = [];
        return cachedSefazCfops;
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const start = lines[0]?.toLowerCase().startsWith("codigo") ? 1 : 0;

    const rows: CfopDTO[] = [];
    const seen = new Set<string>();

    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\d{4});(.*)$/);

        // Handles multiline wrapped descriptions from CSV exports.
        if (!match) {
            if (rows.length > 0) {
                rows[rows.length - 1].descricao = `${rows[rows.length - 1].descricao} ${line.trim().replace(/"$/, "")}`.trim();
            }
            continue;
        }

        const codigo = match[1];
        if (seen.has(codigo)) continue;

        const tipo_operacao = inferTipoOperacao(codigo);
        const ambito = inferAmbito(codigo);
        if (!tipo_operacao || !ambito) continue;

        let descricao = match[2].trim();
        descricao = descricao.replace(/^"/, "").replace(/"$/, "").trim();

        rows.push({
            id: `csv-${codigo}`,
            codigo,
            descricao,
            tipo_operacao,
            ambito,
            ativo: true
        });
        seen.add(codigo);
    }

    cachedSefazCfops = rows.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return cachedSefazCfops;
}

export async function getCfops(supabase: SupabaseClient) {
    const { data, error } = await supabase
        .from('cfop')
        .select('*')
        .eq('ativo', true)
        .order('codigo', { ascending: true });

    const sefazCfops = loadSefazCfopsFromCsv();

    if (error) {
        console.error('Error fetching CFOPs:', error);
        return sefazCfops;
    }

    const dbCfops = (data || []) as CfopDTO[];
    if (dbCfops.length === 0) return sefazCfops;

    // Merge DB + SEFAZ list to guarantee full catalog in dropdown.
    // DB entries override same-code CSV entries.
    const merged = new Map<string, CfopDTO>();
    for (const cfop of sefazCfops) merged.set(cfop.codigo, cfop);
    for (const cfop of dbCfops) merged.set(cfop.codigo, cfop);

    return Array.from(merged.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}
