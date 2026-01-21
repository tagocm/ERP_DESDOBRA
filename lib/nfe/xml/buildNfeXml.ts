import { XMLBuilder } from "fast-xml-parser";
import { NfeDraft } from "../domain/types";
import { validateNfeDraft, validateItemTotals, validateImpostoRules } from "../domain/validators";
import { calcIcmsTot } from "../domain/calculators";
import { NfeBuildError, ValidationIssue } from "../domain/errors";

// Sections
import { buildIde } from "./sections/ide";
import { buildEmit } from "./sections/emit";
import { buildDest } from "./sections/dest";
import { buildDet } from "./sections/det";
import { buildTotal } from "./sections/total";
import { buildTransp } from "./sections/transp";
import { buildPag } from "./sections/pag";
import { buildInfAdic } from "./sections/infAdic";


export interface BuildResult {
    xml: string;
    warnings?: string[];
}

export type BuildMode = "draft" | "transmissible";

export interface BuildOptions {
    mode?: BuildMode;
    tzOffset?: string;
}

export function buildNfeXml(draft: NfeDraft, opts: BuildOptions = {}): BuildResult {
    const mode = opts.mode || "draft";
    const tzOffset = opts.tzOffset || "-03:00";

    // 1. Validate Structure (Schema)
    const schemaErrors = validateNfeDraft(draft);

    if (schemaErrors.length > 0) {
        throw new NfeBuildError(schemaErrors);
    }


    // 2. Validate Business Logic (Totals)
    // Only run if structure is valid to avoid crashes
    const logicErrors = validateItemTotals(draft.itens);
    const impostoErrors = validateImpostoRules(draft.itens);

    const allLogicErrors = [...logicErrors, ...impostoErrors];

    // Mode-specific validations
    if (mode === "transmissible") {
        if (!draft.ide.chNFe || draft.ide.chNFe.length !== 44) {
            allLogicErrors.push({
                path: "ide.chNFe",
                message: "Chave NF-e (44 dígitos) é obrigatória no modo transmissível.",
                code: "PARAMETRIZACAO"
            });
        }
    }

    if (allLogicErrors.length > 0) {
        throw new NfeBuildError(allLogicErrors);
    }

    // 3. Prepare Id and cDV
    let Id = "";
    let cDV = "0";

    if (draft.ide.chNFe && draft.ide.chNFe.length === 44) {
        Id = "NFe" + draft.ide.chNFe;
        cDV = draft.ide.chNFe[43];
    } else {
        // Only allowed in draft mode (transmissible would have thrown above)
        // Draft with missing/invalid key gets placeholder
        Id = "NFe" + "0".repeat(44);
        cDV = "0";
    }

    // 4. Calculate
    const totals = calcIcmsTot(draft);

    // 5. Assemble View Model
    const NFe = {
        infNFe: {
            "@_versao": "4.00",
            "@_Id": Id,
            ide: buildIde(draft.ide, cDV, tzOffset),
            emit: buildEmit(draft.emit),
            dest: buildDest(draft.dest),
            det: draft.itens.map(buildDet),
            total: buildTotal(totals),
            transp: draft.transp ? buildTransp(draft.transp) : { modFrete: "9" },
            pag: buildPag(draft.pag),
            infAdic: draft.infAdic ? buildInfAdic(draft.infAdic) : undefined
        }
    };

    // 4. Build XML
    const builder = new XMLBuilder({
        format: false, // Minified for SEFAZ
        ignoreAttributes: false,
        suppressBooleanAttributes: false
    });

    const xmlContent = builder.build({ NFe });

    const finalXml = `<?xml version="1.0" encoding="UTF-8"?>` +
        `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${xmlContent.replace("<NFe>", "").replace("</NFe>", "")}</NFe>`;

    return { xml: finalXml };
}
