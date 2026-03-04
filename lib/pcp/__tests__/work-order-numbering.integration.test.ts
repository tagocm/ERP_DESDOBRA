import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'

const dbUrl = process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client
let dbReady = true

function shortSlug(prefix: string, id: string): string {
  return `${prefix}-${id.slice(0, 8)}`
}

async function createCompanyAndItem(db: Client, prefix: string): Promise<{ companyId: string; itemId: string }> {
  const companyId = randomUUID()
  const itemId = randomUUID()

  await db.query(
    'INSERT INTO public.companies (id, name, slug) VALUES ($1::uuid, $2::text, $3::text)',
    [companyId, `Empresa ${prefix}`, shortSlug(prefix.toLowerCase(), companyId)]
  )

  await db.query(
    `INSERT INTO public.items (id, company_id, name, type, uom, avg_cost, is_active)
     VALUES ($1::uuid, $2::uuid, $3::text, 'finished_good', 'UN', 0, true)`,
    [itemId, companyId, `Item ${prefix}`]
  )

  return { companyId, itemId }
}

describe('work order document numbering (integration)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl })
    try {
      await client.connect()
    } catch {
      dbReady = false
    }
  })

  afterAll(async () => {
    if (dbReady) {
      await client.end()
    }
  })

  beforeEach(async () => {
    if (!dbReady) return
    await client.query('BEGIN')
  })

  afterEach(async () => {
    if (!dbReady) return
    await client.query('ROLLBACK')
  })

  it('assigns document_number on insert when omitted and increments by company', async () => {
    if (!dbReady) return

    const { companyId, itemId } = await createCompanyAndItem(client, 'WO-NUM-TRG')

    const firstInsert = await client.query<{ document_number: number | null }>(
      `INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date)
       VALUES ($1::uuid, $2::uuid, 10, 'planned', CURRENT_DATE)
       RETURNING document_number`,
      [companyId, itemId]
    )

    const secondInsert = await client.query<{ document_number: number | null }>(
      `INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date)
       VALUES ($1::uuid, $2::uuid, 20, 'planned', CURRENT_DATE)
       RETURNING document_number`,
      [companyId, itemId]
    )

    expect(firstInsert.rows[0]?.document_number).toBe(1)
    expect(secondInsert.rows[0]?.document_number).toBe(2)
  })

  it('reserves unique sequential numbers under concurrent inserts for same company', async () => {
    if (!dbReady) return

    const setupClient = new Client({ connectionString: dbUrl })
    const clientA = new Client({ connectionString: dbUrl })
    const clientB = new Client({ connectionString: dbUrl })

    let companyId = ''
    let itemId = ''

    try {
      await setupClient.connect()
      const seeded = await createCompanyAndItem(setupClient, 'WO-NUM-CC')
      companyId = seeded.companyId
      itemId = seeded.itemId

      await clientA.connect()
      await clientB.connect()

      const insertSql = `
        INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date)
        VALUES ($1::uuid, $2::uuid, 10, 'planned', CURRENT_DATE)
        RETURNING document_number
      `

      const [resultA, resultB] = await Promise.all([
        clientA.query<{ document_number: number | null }>(insertSql, [companyId, itemId]),
        clientB.query<{ document_number: number | null }>(insertSql, [companyId, itemId]),
      ])

      const numbers = [
        resultA.rows[0]?.document_number ?? 0,
        resultB.rows[0]?.document_number ?? 0,
      ].sort((a, b) => a - b)

      expect(numbers).toEqual([1, 2])
    } finally {
      await clientA.end().catch(() => undefined)
      await clientB.end().catch(() => undefined)

      if (companyId) {
        await setupClient.query('DELETE FROM public.work_orders WHERE company_id = $1::uuid', [companyId]).catch(() => undefined)
        await setupClient.query('DELETE FROM public.items WHERE company_id = $1::uuid', [companyId]).catch(() => undefined)
        await setupClient.query('DELETE FROM public.work_order_sequences WHERE company_id = $1::uuid', [companyId]).catch(() => undefined)
        await setupClient.query('DELETE FROM public.companies WHERE id = $1::uuid', [companyId]).catch(() => undefined)
      }

      await setupClient.end().catch(() => undefined)
    }
  })

  it('backfills NULL document numbers without renumbering existing values and syncs next_number', async () => {
    if (!dbReady) return

    const { companyId, itemId } = await createCompanyAndItem(client, 'WO-NUM-BF')

    const fixed = await client.query<{ id: string }>(
      `INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date, document_number)
       VALUES ($1::uuid, $2::uuid, 10, 'planned', CURRENT_DATE, 7)
       RETURNING id`,
      [companyId, itemId]
    )

    const generatedA = await client.query<{ id: string }>(
      `INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date)
       VALUES ($1::uuid, $2::uuid, 10, 'planned', CURRENT_DATE)
       RETURNING id`,
      [companyId, itemId]
    )

    const generatedB = await client.query<{ id: string }>(
      `INSERT INTO public.work_orders (company_id, item_id, planned_qty, status, scheduled_date)
       VALUES ($1::uuid, $2::uuid, 10, 'planned', CURRENT_DATE)
       RETURNING id`,
      [companyId, itemId]
    )

    await client.query(
      `UPDATE public.work_orders
          SET document_number = NULL
        WHERE id IN ($1::uuid, $2::uuid)`,
      [generatedA.rows[0]?.id, generatedB.rows[0]?.id]
    )

    await client.query('SELECT public.backfill_work_order_document_numbers()')
    await client.query('SELECT public.backfill_work_order_document_numbers()')

    const docs = await client.query<{ id: string; document_number: number | null }>(
      `SELECT id, document_number
         FROM public.work_orders
        WHERE company_id = $1::uuid
        ORDER BY created_at, id`,
      [companyId]
    )

    const fixedRow = docs.rows.find((row) => row.id === fixed.rows[0]?.id)
    expect(fixedRow?.document_number).toBe(7)

    const docNumbers = docs.rows
      .map((row) => row.document_number)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)

    expect(docNumbers).toEqual([7, 8, 9])

    const sequenceState = await client.query<{ next_number: number }>(
      `SELECT next_number
         FROM public.work_order_sequences
        WHERE company_id = $1::uuid`,
      [companyId]
    )

    expect(sequenceState.rows[0]?.next_number).toBe(10)
  })

  it('creates work order via dependency RPC without sending document_number and persists generated number', async () => {
    if (!dbReady) return

    const { companyId, itemId } = await createCompanyAndItem(client, 'WO-NUM-RPC')
    const bomId = randomUUID()

    await client.query(
      `INSERT INTO public.bom_headers (id, company_id, item_id, version, yield_qty, yield_uom, is_active)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 1, 'UN', true)`,
      [bomId, companyId, itemId]
    )

    const rpcResult = await client.query<{ payload: { parent_work_order_id: string } }>(
      `SELECT public.create_work_orders_with_dependencies(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        5,
        CURRENT_DATE,
        NULL,
        NULL,
        '[]'::jsonb
      ) AS payload`,
      [companyId, itemId, bomId]
    )

    const parentId = rpcResult.rows[0]?.payload?.parent_work_order_id
    expect(parentId).toBeTruthy()

    const created = await client.query<{ id: string; document_number: number | null }>(
      `SELECT id, document_number
         FROM public.work_orders
        WHERE id = $1::uuid`,
      [parentId]
    )

    expect(created.rows).toHaveLength(1)
    expect(created.rows[0]?.document_number).toBe(1)
  })
})
