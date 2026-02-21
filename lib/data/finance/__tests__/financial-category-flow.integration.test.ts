import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const dbUrl = process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let client: Client;
let dbReady = true;

describe('financial category/account flow (integration)', () => {
    beforeAll(async () => {
        client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
        } catch {
            dbReady = false;
        }
    });

    afterAll(async () => {
        if (dbReady) {
            await client.end();
        }
    });

    beforeEach(async () => {
        if (!dbReady) return;
        await client.query('BEGIN');
    });

    afterEach(async () => {
        if (!dbReady) return;
        await client.query('ROLLBACK');
    });

    it('creates category + child account under selected 4.x folder and links both sides', async () => {
        if (!dbReady) return;

        const companyId = randomUUID();
        await client.query(
            'INSERT INTO public.companies (id, name, slug) VALUES ($1, $2, $3)',
            [companyId, 'Empresa Teste Financeiro', `fin-${companyId.slice(0, 8)}`],
        );

        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyId]);

        const parent = await client.query(
            `SELECT id, code FROM public.gl_accounts
             WHERE company_id = $1::uuid AND code = '4.2'
             LIMIT 1`,
            [companyId],
        );

        expect(parent.rows).toHaveLength(1);
        const parentId = parent.rows[0].id as string;

        const creation = await client.query(
            'SELECT * FROM public.create_financial_category_for_operational_expense($1::uuid, $2::uuid, $3::text)',
            [companyId, parentId, 'Internet Escritório'],
        );

        expect(creation.rows).toHaveLength(1);
        const row = creation.rows[0] as {
            category_id: string;
            account_id: string;
            account_code: string;
        };

        expect(row.account_code).toMatch(/^4\.2\.\d+$/);
        const suffix = Number(row.account_code.split('.').at(-1));
        expect(suffix).toBeGreaterThanOrEqual(13); // seed inserts 4.2.01..4.2.12

        const linked = await client.query(
            `SELECT c.id AS category_id,
                    c.expense_account_id,
                    a.id AS account_id,
                    a.parent_id,
                    a.origin,
                    a.origin_id,
                    p.code AS parent_code
             FROM public.financial_categories c
             JOIN public.gl_accounts a ON a.id = c.expense_account_id
             JOIN public.gl_accounts p ON p.id = a.parent_id
             WHERE c.id = $1::uuid`,
            [row.category_id],
        );

        expect(linked.rows).toHaveLength(1);
        expect(linked.rows[0].expense_account_id).toBe(row.account_id);
        expect(linked.rows[0].origin).toBe('FINANCIAL_CATEGORY');
        expect(linked.rows[0].origin_id).toBe(row.category_id);
        expect(linked.rows[0].parent_code).toBe('4.2');
    });

    it('keeps tenant isolation for generated 4.2.xx accounts', async () => {
        if (!dbReady) return;

        const companyA = randomUUID();
        const companyB = randomUUID();

        await client.query(
            `INSERT INTO public.companies (id, name, slug)
             VALUES ($1, 'Empresa A', $2), ($3, 'Empresa B', $4)`,
            [companyA, `a-${companyA.slice(0, 8)}`, companyB, `b-${companyB.slice(0, 8)}`],
        );

        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyA]);
        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyB]);

        const parentA = await client.query(
            `SELECT id FROM public.gl_accounts WHERE company_id = $1::uuid AND code = '4.2' LIMIT 1`,
            [companyA],
        );
        const parentB = await client.query(
            `SELECT id FROM public.gl_accounts WHERE company_id = $1::uuid AND code = '4.2' LIMIT 1`,
            [companyB],
        );

        await client.query(
            'SELECT * FROM public.create_financial_category_for_operational_expense($1::uuid, $2::uuid, $3::text)',
            [companyA, parentA.rows[0].id, 'Cat A'],
        );
        await client.query(
            'SELECT * FROM public.create_financial_category_for_operational_expense($1::uuid, $2::uuid, $3::text)',
            [companyB, parentB.rows[0].id, 'Cat B'],
        );

        const rowsA = await client.query(
            `SELECT code FROM public.gl_accounts
             WHERE company_id = $1::uuid AND origin = 'FINANCIAL_CATEGORY'
             ORDER BY code`,
            [companyA],
        );

        const rowsB = await client.query(
            `SELECT code FROM public.gl_accounts
             WHERE company_id = $1::uuid AND origin = 'FINANCIAL_CATEGORY'
             ORDER BY code`,
            [companyB],
        );

        expect(rowsA.rows).toHaveLength(1);
        expect(rowsB.rows).toHaveLength(1);
        expect(rowsA.rows[0].code).toBe('4.2.13');
        expect(rowsB.rows[0].code).toBe('4.2.13');
    });

    it('does not reuse suffix after rows are removed (sequence is monotonic)', async () => {
        if (!dbReady) return;

        const companyId = randomUUID();
        await client.query(
            'INSERT INTO public.companies (id, name, slug) VALUES ($1, $2, $3)',
            [companyId, 'Empresa Seq', `seq-${companyId.slice(0, 8)}`],
        );

        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyId]);

        const parent = await client.query(
            `SELECT id FROM public.gl_accounts
             WHERE company_id = $1::uuid AND code = '4.2'
             LIMIT 1`,
            [companyId],
        );
        const parentId = parent.rows[0].id as string;

        const created1 = await client.query(
            'SELECT * FROM public.create_financial_category_for_operational_expense($1::uuid, $2::uuid, $3::text)',
            [companyId, parentId, 'Cat 1'],
        );
        const cat1 = created1.rows[0].category_id as string;
        const acc1 = created1.rows[0].account_id as string;

        // Hard-delete both rows to simulate removal, while keeping the sequence state.
        await client.query('DELETE FROM public.financial_categories WHERE id = $1::uuid', [cat1]);
        await client.query('DELETE FROM public.gl_accounts WHERE id = $1::uuid', [acc1]);

        const created2 = await client.query(
            'SELECT * FROM public.create_financial_category_for_operational_expense($1::uuid, $2::uuid, $3::text)',
            [companyId, parentId, 'Cat 2'],
        );
        expect(created2.rows).toHaveLength(1);
        expect(created2.rows[0].account_code).toBe('4.2.14');
    });
});

