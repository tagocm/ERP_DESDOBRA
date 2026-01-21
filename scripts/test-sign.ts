import draft from "../lib/nfe/__tests__/fixtures/nfeDraft.basic.json";
import { buildNfeXml } from "../lib/nfe/xml/buildNfeXml";
import { signNfeXml } from "../lib/nfe/sign/signNfeXml";
import fs from "fs";

const chNFe = "35191012345678000199550010000000011000000010"; // 44 dígitos (fake)
const pfxPath = "lib/nfe/sign/fixtures/test.pfx";
const pfxBase64 = fs.readFileSync(pfxPath).toString("base64");

const { xml } = buildNfeXml({ ...(draft as any), ide: { ...(draft as any).ide, chNFe } }, { mode: "transmissible" });
const { signedXml } = signNfeXml(xml, { pfxBase64, pfxPassword: "test" }); // ajuste se a senha for outra

console.log(signedXml.includes("<Signature") ? "OK: has Signature" : "FAIL: no Signature");
console.log(signedXml.match(/Reference URI="#([^"]+)"/)?.[0] ?? "FAIL: no Reference");
console.log(signedXml.match(/<CanonicalizationMethod[^>]+Algorithm="([^"]+)"/)?.[0] ?? "FAIL: no C14N");
console.log(signedXml.match(/<Transform[^>]+Algorithm="([^"]+)"/g)?.join("\n") ?? "FAIL: no Transforms");
