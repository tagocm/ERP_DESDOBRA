import { createAdminClient } from '@/lib/supabaseServer'
import { logger } from '@/lib/logger'
import { expensePayloadSchema, expensePayloadV2 } from '@/lib/validations/mobile-sync'

type MobileExpenseRow = {
    id: string
    company_id: string
    event_id: string
    event_type: string
    payload: unknown
}

type ProcessorOptions = {
    limit?: number
    companyId?: string
    dryRun?: boolean
}

export type ProcessorResult = {
    totalFetched: number
    processed: number
    alreadyExists: number
    errors: number
}

function normalizeDateOnly(input: string): string | null {
    const match = input.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!match) return null
    return match[1]
}

function truncateText(value: string, maxLen: number) {
    if (value.length <= maxLen) return value
    return value.slice(0, maxLen - 1) + '…'
}

async function resolveOrCreateSupplier(
    supabase: ReturnType<typeof createAdminClient>,
    companyId: string,
    tradeNameRaw: string | null | undefined
) {
    const tradeName = truncateText((tradeNameRaw || 'Despesa Mobile').trim() || 'Despesa Mobile', 120)

    const { data: existing, error: findError } = await supabase
        .from('organizations')
        .select('id, trade_name')
        .eq('company_id', companyId)
        .eq('trade_name', tradeName)
        .is('deleted_at', null)
        .limit(1)

    if (findError) throw findError
    if (existing && existing.length > 0) {
        return { id: existing[0].id as string, tradeName }
    }

    const { data: created, error: createError } = await supabase
        .from('organizations')
        .insert({
            company_id: companyId,
            trade_name: tradeName,
            status: 'active',
        })
        .select('id')
        .single()

    if (createError) throw createError

    const orgId = created.id as string

    // Ensure supplier role exists (idempotent)
    const { error: roleError } = await supabase
        .from('organization_roles')
        .upsert(
            {
                company_id: companyId,
                organization_id: orgId,
                role: 'supplier',
                deleted_at: null,
            },
            { onConflict: 'company_id,organization_id,role' }
        )
    if (roleError) throw roleError

    return { id: orgId, tradeName }
}

async function resolveGlAccountIdByCode(
    supabase: ReturnType<typeof createAdminClient>,
    companyId: string,
    code: string | null | undefined
) {
    const normalized = code?.trim()
    if (!normalized) return null

    const { data, error } = await supabase
        .from('gl_accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', normalized)
        .maybeSingle()

    if (error) return null
    return data?.id ?? null
}

export async function processMobileExpenseInbox(options: ProcessorOptions = {}): Promise<ProcessorResult> {
    const supabase = createAdminClient()

    const limit = options.limit ?? 50
    const dryRun = options.dryRun ?? false
    const companyId = options.companyId

    let query = supabase
        .from('mobile_expense_events')
        .select('id, company_id, event_id, event_type, payload')
        .eq('status', 'received')
        .is('processed_at', null)
        .order('received_at', { ascending: true })
        .limit(limit)

    if (companyId) query = query.eq('company_id', companyId)

    const { data: rows, error } = await query

    if (error) throw error

    const events: MobileExpenseRow[] = (rows || []) as MobileExpenseRow[]

    const result: ProcessorResult = {
        totalFetched: events.length,
        processed: 0,
        alreadyExists: 0,
        errors: 0,
    }

    for (const row of events) {
        const eventId = row.event_id

        try {
            if (row.event_type !== 'CREATE_EXPENSE') {
                throw new Error(`Unsupported event_type: ${row.event_type}`)
            }

            const v2 = expensePayloadV2.safeParse(row.payload)
            const v1 = v2.success ? null : expensePayloadSchema.safeParse(row.payload)

            if (!v2.success && (!v1 || !v1.success)) {
                throw new Error('Invalid expense payload')
            }

            const payloadVersion = v2.success ? 'v2' : 'v1'
            const amount = v2.success ? v2.data.amount_cents / 100 : (v1 as any).data.amount
            const issueDateRaw = v2.success ? v2.data.date : (v1 as any).data.date
            const issueDate = normalizeDateOnly(issueDateRaw)
            if (!issueDate) {
                throw new Error('Invalid date format')
            }

            const merchantName = v2.success ? v2.data.merchant_name : (v1 as any).data.merchant_name
            const { id: partnerId, tradeName: partnerName } = await resolveOrCreateSupplier(
                supabase,
                row.company_id,
                merchantName
            )

            const description = v2.success ? (v2.data.description || 'Despesa mobile') : (v1 as any).data.description
            const notes = v2.success ? v2.data.notes : (v1 as any).data.notes

            const accountCode = v2.success ? v2.data.account_code : null
            const categoryCode = v2.success ? v2.data.category_code : null
            const suggestedAccountId = await resolveGlAccountIdByCode(supabase, row.company_id, accountCode)
            const categoryId = v2.success ? null : ((v1 as any).data.category_id ?? null)

            const eventNotesParts: string[] = []
            if (description) eventNotesParts.push(description)
            if (notes) eventNotesParts.push(notes)
            if (payloadVersion === 'v2') {
                eventNotesParts.push(`(mobile:v2 account_code=${accountCode} category_code=${categoryCode})`)
            }

            if (dryRun) {
                logger.info('[mobile-processor] dryRun event accepted', { event_id: eventId, payloadVersion })
                result.processed += 1
                continue
            }

            // 1) Create or fetch Financial Event (idempotent by origin)
            let financialEventId: string | null = null

            const { data: insertedEvent, error: insertEventError } = await supabase
                .from('financial_events')
                .insert({
                    company_id: row.company_id,
                    origin_type: 'EXPENSE',
                    origin_id: eventId,
                    origin_reference: `MOBILE:${eventId}`,
                    partner_id: partnerId,
                    partner_name: partnerName,
                    direction: 'AP',
                    issue_date: issueDate,
                    total_amount: amount,
                    status: 'pending',
                    notes: truncateText(eventNotesParts.join('\n'), 4000) || null,
                })
                .select('id')
                .single()

            if (insertEventError) {
                if (insertEventError.code !== '23505') throw insertEventError

                const { data: existingEvent, error: findEventError } = await supabase
                    .from('financial_events')
                    .select('id')
                    .eq('company_id', row.company_id)
                    .eq('origin_type', 'EXPENSE')
                    .eq('origin_id', eventId)
                    .maybeSingle()

                if (findEventError || !existingEvent) {
                    throw findEventError || new Error('Existing financial_event not found after conflict')
                }

                financialEventId = existingEvent.id as string
                result.alreadyExists += 1
            } else {
                financialEventId = insertedEvent.id as string
            }

            // 2) Create/Upsert Installment #1
            const { error: installmentError } = await supabase
                .from('financial_event_installments')
                .upsert(
                    {
                        event_id: financialEventId,
                        installment_number: 1,
                        due_date: issueDate,
                        amount,
                        payment_condition: 'À vista',
                        payment_method: null,
                        suggested_account_id: suggestedAccountId,
                        category_id: categoryId,
                        cost_center_id: null,
                        notes: null,
                    },
                    { onConflict: 'event_id,installment_number' }
                )
            if (installmentError) throw installmentError

            // 3) Mark inbox event as processed
            const { error: markProcessedError } = await supabase
                .from('mobile_expense_events')
                .update({
                    status: 'processed',
                    processed_at: new Date().toISOString(),
                    error_message: null,
                })
                .eq('id', row.id)
            if (markProcessedError) throw markProcessedError

            result.processed += 1
        } catch (err: unknown) {
            result.errors += 1
            const message = err instanceof Error ? err.message : 'Unknown error'
            logger.error('[mobile-processor] Failed to process event', { event_id: eventId, message })

            if (!dryRun) {
                await supabase
                    .from('mobile_expense_events')
                    .update({
                        status: 'error',
                        error_message: truncateText(message, 300),
                    })
                    .eq('id', row.id)
            }
        }
    }

    return result
}
