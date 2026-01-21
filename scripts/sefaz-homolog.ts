import fs from "fs";
import path from "path";
import { emitirNfeHomolog } from "../lib/nfe/sefaz/services/emitir";
import { NfeDraft } from "../lib/nfe/domain/types";

// Helper to load envs if not set (simple .env loader for script)
function loadEnv() {
    if (fs.existsSync(".env")) {
        const content = fs.readFileSync(".env", "utf-8");
        content.split("\n").forEach(line => {
            const [key, ...vals] = line.split("=");
            if (key && vals.length > 0 && !process.env[key.trim()]) {
                process.env[key.trim()] = vals.join("=").trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

async function main() {
    loadEnv();

    const pfxPath = process.env.SEFAZ_PFX_PATH;
    const pfxPassword = process.env.SEFAZ_PFX_PASSWORD;
    const caBundlePath = process.env.SEFAZ_CA_BUNDLE_PATH;

    if (!pfxPath || !pfxPassword) {
        console.error("Erro: Env vars SEFAZ_PFX_PATH e SEFAZ_PFX_PASSWORD são obrigatórias.");
        process.exit(1);
    }

    console.log("=== Teste Manual SEFAZ Homologação ===");
    console.log(`PFX: ${pfxPath}`);
    if (caBundlePath) {
        console.log(`CA Bundle: ${caBundlePath}`);
    }

    // Load PFX
    const pfxBuffer = fs.readFileSync(pfxPath);
    const pfxBase64 = pfxBuffer.toString("base64");

    // Load Fixture
    const fixturePath = path.resolve(process.cwd(), "lib/nfe/__tests__/fixtures/nfeDraft.basic.json");
    if (!fs.existsSync(fixturePath)) {
        console.error(`Erro: Fixture não encontrada em ${fixturePath}`);
        process.exit(1);
    }
    const draft = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as NfeDraft;

    // Changes to make draft unique/valid for test if needed
    // E.g. update ide.nNF or dhEmi?
    // For now, using as is. Warning: Duplicate nNF might cause rejection 204 (Duplicidade).
    // Users normally fix this in the fixture or we allow existing rejection.

    const idLote = Date.now().toString().slice(-15); // max 15 digits
    console.log(`ID Lote: ${idLote}`);

    try {
        const result = await emitirNfeHomolog(
            draft,
            { pfxBase64, pfxPassword },
            idLote,
            {
                debug: true,
                debugDir: "/tmp/desdobra-sefaz",
                timeoutMs: 60000,
                // caPem is automatically handled by SEFAZ_CA_BUNDLE_PATH inside soapClient if not passed here,
                // but we can also pass it explicitly if we wanted to test that path.
                // The requirement says "Ler env SEFAZ_CA_BUNDLE_PATH (opcional)" inside soapClient mainly,
                // but script requirement says "Ler env...".
                // Since soapClient handles env, we don't strictly *need* to read and pass it, but it doesn't hurt.
            }
        );

        console.log("\n>>> Resultado Final <<<");
        console.log(`Success: ${result.success}`);
        console.log(`cStat: ${result.cStat}`);
        console.log(`xMotivo: ${result.xMotivo}`);
        if (result.protNFeXml) {
            console.log("\nProtocolo XML:");
            console.log(result.protNFeXml.substring(0, 200) + "...");
        }
        console.log("\nLogs:", result.logs);

    } catch (err: any) {
        console.error("\n>>> Exception <<<");
        console.error(err);
        if (err.details) {
            console.error("Details:", JSON.stringify(err.details, null, 2));
        }
    }
}

main().catch(console.error);
