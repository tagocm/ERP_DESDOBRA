import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { organizationsRepo } from '@/lib/data/organizations'

const updateOrgSchema = z.object({
    companyId: z.string().uuid(),
    trade_name: z.string().optional(),
    legal_name: z.string().optional(),
    document: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().optional(),
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params are async in Next.js 15
) {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
        return NextResponse.json(
            { error: 'Missing companyId query parameter' },
            { status: 400 }
        )
    }

    try {
        const data = await organizationsRepo.getById(companyId, id)
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const body = await request.json()
        const parsed = updateOrgSchema.parse(body)

        const data = await organizationsRepo.update(parsed.companyId, id, {
            trade_name: parsed.trade_name,
            legal_name: parsed.legal_name,
            document_number: parsed.document,
            status: parsed.status,
            notes: parsed.notes,
        })

        return NextResponse.json(data)
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    if (!companyId) {
        return NextResponse.json(
            { error: 'Missing companyId query parameter' },
            { status: 400 }
        )
    }

    try {
        await organizationsRepo.softDelete(companyId, id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
