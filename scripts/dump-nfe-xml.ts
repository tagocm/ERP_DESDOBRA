import { buildNfeXml } from "../lib/nfe/xml/buildNfeXml";
import basicDraft from "../lib/nfe/__tests__/fixtures/nfeDraft.basic.json";
import { NfeDraft } from "../lib/nfe/domain/types";

// Force load full XML without truncation
async function main() {
    try {
        console.error("Gerando XML NF-e...");

        // Cast fixture to type (assuming correct structure from tests)
        const draft = basicDraft as unknown as NfeDraft;

        const result = buildNfeXml(draft);

        // console.log truncates large strings in some environments (like standard Node REPL sometimes, though usually not piped output)
        // But to be sure, we just log it.
        // User complaint was about truncation/slice in previous script version.
        // We output RAW XML to stdout.
        process.stdout.write(result.xml);
        process.stdout.write("\n"); // Final newline

        console.error("XML gerado com sucesso (stdout).");
    } catch (e) {
        console.error("Erro ao gerar XML:", e);
        process.exit(1);
    }
}

main();
