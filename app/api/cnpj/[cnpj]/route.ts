
import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache
// Key: CNPJ digits
// Value: { data: NormalizedData, expiresAt: number }
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ cnpj: string }> }
) {
    const { cnpj } = await context.params;
    // 1. Validate Input
    const digits = cnpj.replace(/\D/g, "");

    if (digits.length !== 14) {
        return NextResponse.json(
            { error: "CNPJ inválido. Deve conter 14 dígitos." },
            { status: 400 }
        );
    }

    // 2. Check Cache
    const now = Date.now();
    if (cache.has(digits)) {
        const cached = cache.get(digits)!;
        if (cached.expiresAt > now) {
            console.log(`[CNPJ API] Cache hit for ${digits}`);
            return NextResponse.json(cached.data);
        } else {
            cache.delete(digits);
        }
    }

    // 3. Fetch from BrasilAPI
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; ERP-Desdobra/1.0)",
            },
        });

        if (response.status === 404) {
            return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 404 });
        }

        if (response.status === 429) {
            return NextResponse.json(
                { error: "Muitas requisições. Tente novamente em alguns instantes." },
                { status: 429 }
            );
        }

        if (!response.ok) {
            throw new Error(`BrasilAPI error: ${response.statusText}`);
        }

        const data = await response.json();

        // 4. Normalize Data (DTO)
        const normalizedData = {
            legal_name: data.razao_social || null,
            trade_name: data.nome_fantasia || data.razao_social || null,
            cnpj: digits,
            status: data.descricao_situacao_cadastral || null,
            cnae_code: data.cnae_fiscal || null,
            cnae_description: data.cnae_fiscal_descricao || null,
            cnae: data.cnae_fiscal_descricao || null, // Keeping for backward compatibility if needed, but we should use split fields

            email: data.email || null,
            phone: data.ddd_telefone_1 || null,
            address: {
                zip: data.cep || null,
                street: data.logradouro || null,
                number: data.numero || null,
                complement: data.complemento || null,
                neighborhood: data.bairro || null,
                city: data.municipio || null,
                state: data.uf || null,
                ibge: data.codigo_municipio || null,
                country: "BR",
            },
            // Raw data for other needs? No, stick to DTO.
        };

        // Fix: BrasilAPI sometimes returns empty strings instead of null
        // Helper to empty string to null if needed? The user logic handles overwrite only if empty, so empty string is fine if UI treats it as empty.

        // 5. Store in Cache
        cache.set(digits, {
            data: normalizedData,
            expiresAt: now + CACHE_TTL_MS,
        });

        return NextResponse.json(normalizedData);

    } catch (error: any) {
        console.error("[CNPJ API] Error:", error);
        return NextResponse.json(
            { error: "Erro ao consultar dados do CNPJ." },
            { status: 500 }
        );
    }
}
