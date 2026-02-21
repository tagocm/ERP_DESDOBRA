import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const dbUrl = process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let client: Client;
let dbReady = true;

describe('revenue category/account flow (integration)', () => {
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

    it('creates category + child account under 1.1 and links both sides', async () => {
        if (!dbReady) return;

        const companyId = randomUUID();
        const slug = `co-${companyId.slice(0, 8)}`;

        await client.query(
            'INSERT INTO public.companies (id, name, slug) VALUES ($1, $2, $3)',
            [companyId, 'Empresa Teste A', slug],
        );

        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyId]);

        const creation = await client.query(
            'SELECT * FROM public.create_revenue_category_for_finished_product($1::uuid, $2::text)',
            [companyId, 'Categoria A'],
        );

        expect(creation.rows).toHaveLength(1);
        const row = creation.rows[0] as {
            category_id: string;
            account_id: string;
            account_code: string;
        };

        expect(row.account_code).toMatch(/^1\.1\.\d+$/);

        const linked = await client.query(
            `SELECT c.id AS category_id, c.revenue_account_id, a.id AS account_id, a.parent_id, a.origin, a.origin_id
             FROM public.product_categories c
             JOIN public.gl_accounts a ON a.id = c.revenue_account_id
             WHERE c.id = $1::uuid`,
            [row.category_id],
        );

        expect(linked.rows).toHaveLength(1);
        expect(linked.rows[0].revenue_account_id).toBe(row.account_id);
        expect(linked.rows[0].origin).toBe('PRODUCT_CATEGORY');
        expect(linked.rows[0].origin_id).toBe(row.category_id);

        const inTree = await client.query(
            `SELECT COUNT(*)::int AS cnt
             FROM public.gl_accounts a
             JOIN public.gl_accounts p ON p.id = a.parent_id
             WHERE a.company_id = $1::uuid
               AND p.code = '1.1'
               AND a.origin = 'PRODUCT_CATEGORY'`,
            [companyId],
        );

        expect(inTree.rows[0].cnt).toBeGreaterThan(0);
    });

    it('keeps tenant isolation for generated 1.1.xx accounts', async () => {
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

        await client.query('SELECT * FROM public.create_revenue_category_for_finished_product($1::uuid, $2::text)', [companyA, 'Cat A']);
        await client.query('SELECT * FROM public.create_revenue_category_for_finished_product($1::uuid, $2::text)', [companyB, 'Cat B']);

        const rowsA = await client.query(
            `SELECT code FROM public.gl_accounts
             WHERE company_id = $1::uuid AND origin = 'PRODUCT_CATEGORY'
             ORDER BY code`,
            [companyA],
        );

        const rowsB = await client.query(
            `SELECT code FROM public.gl_accounts
             WHERE company_id = $1::uuid AND origin = 'PRODUCT_CATEGORY'
             ORDER BY code`,
            [companyB],
        );

        expect(rowsA.rows).toHaveLength(1);
        expect(rowsB.rows).toHaveLength(1);
        expect(rowsA.rows[0].code).toBe('1.1.01');
        expect(rowsB.rows[0].code).toBe('1.1.01');
    });

    it('prevents delete when category is in use by products', async () => {
        if (!dbReady) return;

        const companyId = randomUUID();
        await client.query(
            'INSERT INTO public.companies (id, name, slug) VALUES ($1, $2, $3)',
            [companyId, 'Empresa Uso', `use-${companyId.slice(0, 8)}`],
        );

        await client.query('SELECT public.seed_chart_spine($1::uuid)', [companyId]);

        const created = await client.query(
            'SELECT * FROM public.create_revenue_category_for_finished_product($1::uuid, $2::text)',
            [companyId, 'Categoria em Uso'],
        );

        const categoryId = created.rows[0].category_id as string;

        await client.query(
            `INSERT INTO public.items (company_id, name, type, uom, category_id, is_active)
             VALUES ($1::uuid, $2::text, 'finished_good', 'UN', $3::uuid, true)`,
            [companyId, 'Produto em Uso', categoryId],
        );

        await expect(
            client.query(
                'SELECT * FROM public.delete_revenue_category_if_unused($1::uuid, $2::uuid)',
                [companyId, categoryId],
            ),
        ).rejects.toMatchObject({
            message: expect.stringContaining('Categoria em uso'),
        });
    });
});
