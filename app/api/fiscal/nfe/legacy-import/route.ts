export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/auth/resolve-company";
import {
    createLegacyImportDependencies,
    importLegacyNfeXmlFiles,
    type LegacyImportUploadFile,
} from "@/lib/fiscal/nfe/legacy-import/importer";

const MAX_FILES_PER_REQUEST = 50;

function parseUploadFiles(formData: FormData): LegacyImportUploadFile[] {
    const fileEntries = formData
        .getAll("files")
        .filter((entry): entry is File => typeof entry !== "string");

    return fileEntries.map((file) => ({
        name: file.name,
        size: file.size,
        arrayBuffer: () => file.arrayBuffer(),
        text: () => file.text(),
    }));
}

export async function POST(request: NextRequest) {
    try {
        let context: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            context = await resolveCompanyContext();
        } catch {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const formData = await request.formData();
        const files = parseUploadFiles(formData);

        if (files.length === 0) {
            return NextResponse.json({ error: "Nenhum arquivo XML informado." }, { status: 400 });
        }

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json(
                { error: `Limite excedido. Envie no máximo ${MAX_FILES_PER_REQUEST} arquivos por vez.` },
                { status: 400 },
            );
        }

        const dependencies = createLegacyImportDependencies();
        const summary = await importLegacyNfeXmlFiles({
            companyId: context.companyId,
            userId: context.userId,
            files,
            dependencies,
        });

        return NextResponse.json({ success: true, ...summary });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro interno ao importar XML legado.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
