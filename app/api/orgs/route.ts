import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { organizationsRepo } from '@/lib/data/organizations'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import { errorResponse } from '@/lib/api/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Schema for creating an organization
const createOrgSchema = z.object({
    companyId: z.string().uuid().optional(),
    trade_name: z.string().min(1),
    legal_name: z.string().optional(),
    document: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    let activeCompanyId: string
    try {
        activeCompanyId = await getActiveCompanyId()
    } catch {
        return errorResponse('Unauthorized', 401)
    }

    if (companyId && companyId !== activeCompanyId) return errorResponse('Forbidden', 403)

    try {
        const data = await organizationsRepo.list(activeCompanyId)
        return NextResponse.json(data)
    } catch (error: any) {
        return errorResponse('Internal Server Error', 500, undefined, error instanceof Error ? error.message : error)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = createOrgSchema.parse(body)

        let activeCompanyId: string
        try {
            activeCompanyId = await getActiveCompanyId()
        } catch {
            return errorResponse('Unauthorized', 401)
        }

        if (parsed.companyId && parsed.companyId !== activeCompanyId) return errorResponse('Forbidden', 403)

        const data = await organizationsRepo.create(activeCompanyId, {
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
        return errorResponse('Internal Server Error', 500, undefined, error instanceof Error ? error.message : error)
    }
}
