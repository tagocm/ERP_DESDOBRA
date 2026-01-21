import { buildNfeXml } from "../lib/nfe/xml/buildNfeXml";
import basicDraft from "../lib/nfe/__tests__/fixtures/nfeDraft.basic.json";
import { NfeDraft } from "../lib/nfe/domain/types";

function extractBlock(xml: string, tagName: string): string {
    const startTag = `<${tagName}`;
    const endTag = `</${tagName}>`;

    // Simple verification for self-closing or normal tags (standard NFe uses normal tags for groups)
    const startIndex = xml.indexOf(startTag);
    if (startIndex === -1) return `BLOCO NAO ENCONTRADO: <${tagName}>`;

    // Find end tag
    const endIndex = xml.indexOf(endTag, startIndex);
    if (endIndex === -1) return `FIM DO BLOCO NAO ENCONTRADO: </${tagName}>`;

    return xml.substring(startIndex, endIndex + endTag.length);
}

async function main() {
    try {
        const draft = basicDraft as unknown as NfeDraft;
        const { xml } = buildNfeXml(draft);

        console.log("=== DET ===");
        // NFe det has attribute nItem, so <det nItem="1">
        // Generic finder above might need check.
        // Let's implement specific logic for 'det' because it can appear multiple times. We just want the first one or all?
        // User said: "(apenas o primeiro det)"

        const firstDetStart = xml.indexOf("<det");
        if (firstDetStart === -1) {
            console.log("BLOCO NAO ENCONTRADO: <det>");
        } else {
            const firstDetEnd = xml.indexOf("</det>", firstDetStart);
            if (firstDetEnd !== -1) {
                console.log(xml.substring(firstDetStart, firstDetEnd + 6)); // + length of </det>
            } else {
                console.log("FIM DO BLOCO NAO ENCONTRADO: </det>");
            }
        }

        console.log("\n=== TOTAL ===");
        // total block
        console.log(extractBlock(xml, "total"));

        console.log("\n=== PAG ===");
        // pag block
        console.log(extractBlock(xml, "pag"));

    } catch (e) {
        console.error("Erro ao gerar blocos:", e);
        process.exit(1);
    }
}

main();
