import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { organizationsRepo } from '@/lib/data/organizations'

// Schema for creating an organization
const createOrgSchema = z.object({
    companyId: z.string().uuid(),
    trade_name: z.string().min(1),
    legal_name: z.string().optional(),
    document: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
        return NextResponse.json(
            { error: 'Missing companyId query parameter' },
            { status: 400 }
        )
    }

    try {
        const data = await organizationsRepo.list(companyId)
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = createOrgSchema.parse(body)

        const data = await organizationsRepo.create(parsed.companyId, {
            trade_name: parsed.trade_name,
            legal_name: parsed.legal_name,
            document_number: parsed.document,
            status: parsed.status,
            notes: parsed.notes,
        })

        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
