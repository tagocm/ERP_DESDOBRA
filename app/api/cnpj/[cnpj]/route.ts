
import { NextResponse } from "next/server";

export async function GET(request: Request, props: { params: Promise<{ cnpj: string }> }) {
    const params = await props.params;
    const cnpj = params.cnpj;

    if (!cnpj) {
        return NextResponse.json({ error: "CNPJ is required" }, { status: 400 });
    }

    try {
        // Remove non-digits
        const digits = cnpj.replace(/\D/g, '');

        if (digits.length !== 14) {
            return NextResponse.json({ error: "Invalid CNPJ length" }, { status: 400 });
        }

        // Fetch from BrasilAPI
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
            headers: {
                'User-Agent': 'ERP_Desdobra/1.0',
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            if (res.status === 404) {
                return NextResponse.json({ error: "CNPJ not found" }, { status: 404 });
            }
            return NextResponse.json({ error: "External API error" }, { status: res.status });
        }

        const data = await res.json();

        // Map to our expected format
        const result = {
            legal_name: data.razao_social,
            trade_name: data.nome_fantasia || data.razao_social,
            cnae_code: data.cnae_fiscal,
            cnae_description: data.cnae_fiscal_descricao,
            address: {
                zip: data.cep,
                street: data.logradouro,
                number: data.numero,
                complement: data.complemento,
                neighborhood: data.bairro,
                city: data.municipio,
                state: data.uf,
                ibge: data.codigo_municipio_ibge
            },
            email: data.email,
            phone: data.ddd_telefone_1
        };

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("CNPJ Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
