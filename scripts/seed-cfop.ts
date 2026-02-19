import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CFOP_FILE = path.join(process.cwd(), "data/seeds/cfop.csv");

async function seedCfops() {
    console.log("Starting CFOP seed...");

    if (!fs.existsSync(CFOP_FILE)) {
        console.error(`File not found: ${CFOP_FILE}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(CFOP_FILE, "utf-8");
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);

    // Skip header if present (codigo;descricao)
    const startIndex = lines[0].toLowerCase().startsWith("codigo") ? 1 : 0;

    let upserted = 0;
    let errors = 0;

    console.log(`Found ${lines.length - startIndex} lines to process.`);

    const batchSize = 100;
    const allItems: any[] = [];
    const seenCodes = new Set<string>();

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];

        // Check if line starts with 4 digits and semicolon
        const match = line.match(/^(\d{4});(.*)$/);

        if (!match) {
            // Handle multiline descriptions (continuation lines)
            // If we have a current batch, append to the last item
            if (allItems.length > 0) {
                const lastItem = allItems[allItems.length - 1];
                // Clean up quotes from the appended line
                let cleanLine = line.trim();
                if (cleanLine.endsWith('"')) cleanLine = cleanLine.slice(0, -1);
                lastItem.descricao += " " + cleanLine;
            }
            continue;
        }

        const codigo = match[1];
        let descricao = match[2];

        // Start fresh item
        // Remove starting quote if strictly present
        if (descricao.startsWith('"')) {
            descricao = descricao.substring(1);
        }
        // Remove ending quote if strictly present (single line case)
        if (descricao.endsWith('"')) {
            descricao = descricao.substring(0, descricao.length - 1);
        }

        // Determine Type and Scope
        const firstDigit = parseInt(codigo[0]);
        let tipo_operacao = "";
        let ambito = "";

        // Entrance: 1, 2, 3
        if ([1, 2, 3].includes(firstDigit)) tipo_operacao = "entrada";
        // Exit: 5, 6, 7
        if ([5, 6, 7].includes(firstDigit)) tipo_operacao = "saida";

        // Scope
        if ([1, 5].includes(firstDigit)) ambito = "estadual";
        if ([2, 6].includes(firstDigit)) ambito = "interestadual";
        if ([3, 7].includes(firstDigit)) ambito = "exterior";

        if (!tipo_operacao || !ambito) {
            console.warn(`Skipping code ${codigo}: invalid first digit`);
            continue;
        }

        const newItem = {
            codigo,
            descricao: descricao.trim(),
            tipo_operacao,
            ambito,
            ativo: true
        };

        // Check duplicate
        if (seenCodes.has(codigo)) {
            console.warn(`Duplicate found for code ${codigo}, skipping.`);
            continue;
        }

        seenCodes.add(codigo);
        allItems.push(newItem);
    }

    console.log(`Prepared ${allItems.length} unique items for insertion.`);

    // Batch insert
    for (let i = 0; i < allItems.length; i += batchSize) {
        const batch = allItems.slice(i, i + batchSize);
        const { error } = await supabase.from("cfop").upsert(batch, { onConflict: "codigo" });

        if (error) {
            console.error("Batch error:", error);
            errors += batch.length;
        } else {
            upserted += batch.length;
        }
    }

    // Final logging
    console.log(`Finished. Upserted: ${upserted}, Errors: ${errors}`);
}

seedCfops().catch(console.error);
