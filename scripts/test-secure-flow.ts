import { encryptPassword, decryptPassword, generateEncryptionKey } from "../lib/vault-helpers";
import { parsePfx } from "../lib/nfe/sign/cert";
import fs from "fs";
import path from "path";

async function main() {
    console.log("=== Testing Secure A1 Flow ===");

    // 1. Setup Env Mock
    if (!process.env.CERT_PASSWORD_ENCRYPTION_KEY) {
        console.warn("WARN: CERT_PASSWORD_ENCRYPTION_KEY not set. Generating temporary one for test.");
        process.env.CERT_PASSWORD_ENCRYPTION_KEY = generateEncryptionKey();
        console.log("Mock Key:", process.env.CERT_PASSWORD_ENCRYPTION_KEY);
    }

    // 2. Test Roundtrip Encryption
    const originalPassword = "test-password-123";
    console.log(`\n1. Testing Encryption Roundtrip for "${originalPassword}"...`);

    const encrypted = await encryptPassword(originalPassword);
    console.log("Encrypted:", encrypted);

    const decrypted = await decryptPassword(encrypted);
    console.log("Decrypted:", decrypted);

    if (decrypted !== originalPassword) {
        console.error("FAIL: Decrypted password does not match original!");
        process.exit(1);
    }
    console.log("SUCCESS: Encryption roundtrip works.");

    // 3. Test PFX Parsing (if file available)
    const pfxPath = process.env.SEFAZ_PFX_PATH;
    const pfxPass = process.env.SEFAZ_PFX_PASSWORD;

    if (pfxPath && pfxPass) {
        console.log(`\n2. Testing PFX Expiration Extraction from ${pfxPath}...`);
        try {
            const pfxBuffer = fs.readFileSync(pfxPath);
            const pfxBase64 = pfxBuffer.toString("base64");

            const pfxData = parsePfx(pfxBase64, pfxPass);
            console.log("Subject:", pfxData.certInfo.subject);
            console.log("Not After (Expires At):", pfxData.certInfo.notAfter);
            console.log("SUCCESS: PFX Parsed.");
        } catch (err: any) {
            console.error("FAIL: PFX Parse Error:", err.message);
        }
    } else {
        console.log("\n2. PFX Test skipped (SEFAZ_PFX_PATH/PASSWORD not set)");
    }
}

main().catch(console.error);
