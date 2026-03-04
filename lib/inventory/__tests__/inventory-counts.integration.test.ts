import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const dbUrl = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let client: Client;
let dbReady = true;
let featureReady = true;

function shortSlug(prefix: string, id: string): string {
  return `${prefix}-${id.slice(0, 8)}`;
}

async function createCompanyAndItem(
  db: Client,
  prefix: string
): Promise<{ companyId: string; itemId: string }> {
  const companyId = randomUUID();
  const itemId = randomUUID();

  await db.query(
    "INSERT INTO public.companies (id, name, slug) VALUES ($1::uuid, $2::text, $3::text)",
    [companyId, `Empresa ${prefix}`, shortSlug(prefix.toLowerCase(), companyId)]
  );

  await db.query(
    `INSERT INTO public.items (id, company_id, name, type, uom, avg_cost, is_active)
     VALUES ($1::uuid, $2::uuid, $3::text, 'raw_material', 'KG', 0, true)`,
    [itemId, companyId, `Item ${prefix}`]
  );

  return { companyId, itemId };
}

describe("inventory count posting (integration)", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();

      const relationCheck = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'inventory_counts'
         ) AS exists`
      );

      const functionCheck = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM pg_proc
            WHERE proname = 'post_inventory_count'
         ) AS exists`
      );

      featureReady = Boolean(relationCheck.rows[0]?.exists && functionCheck.rows[0]?.exists);
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
    if (!dbReady || !featureReady) return;
    await client.query("BEGIN");
  });

  afterEach(async () => {
    if (!dbReady || !featureReady) return;
    await client.query("ROLLBACK");
  });

  it("creates AJUSTE movements from counted vs system diff and marks count as POSTED", async () => {
    if (!dbReady || !featureReady) return;

    const { companyId, itemId } = await createCompanyAndItem(client, "INV-POST");

    const insertedCount = await client.query<{ id: string; number: number | null }>(
      `INSERT INTO public.inventory_counts (company_id, status, counted_at, notes)
       VALUES ($1::uuid, 'DRAFT', now(), 'Inventário de teste')
       RETURNING id, number`,
      [companyId]
    );

    const inventoryCountId = insertedCount.rows[0]?.id;
    expect(inventoryCountId).toBeTruthy();
    expect(insertedCount.rows[0]?.number).toBe(1);

    await client.query(
      `INSERT INTO public.inventory_count_lines (
        company_id,
        inventory_count_id,
        item_id,
        system_qty_base,
        counted_qty_base,
        notes
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, 10, 7.5, 'Ajuste de teste')`,
      [companyId, inventoryCountId, itemId]
    );

    const postResult = await client.query<{ payload: { posted_items: number; status: string } }>(
      `SELECT public.post_inventory_count($1::uuid, NULL::uuid) AS payload`,
      [inventoryCountId]
    );

    expect(postResult.rows[0]?.payload?.status).toBe("POSTED");
    expect(postResult.rows[0]?.payload?.posted_items).toBe(1);

    const movement = await client.query<{
      movement_type: string;
      qty_in: string;
      qty_out: string;
      qty_base: string;
      reference_type: string | null;
      reference_id: string | null;
    }>(
      `SELECT movement_type, qty_in::text, qty_out::text, qty_base::text, reference_type, reference_id::text
         FROM public.inventory_movements
        WHERE company_id = $1::uuid
          AND reference_type = 'inventory_count'
          AND reference_id = $2::uuid
          AND item_id = $3::uuid`,
      [companyId, inventoryCountId, itemId]
    );

    expect(movement.rows).toHaveLength(1);
    expect(movement.rows[0]?.movement_type).toBe("AJUSTE");
    expect(movement.rows[0]?.qty_in).toBe("0.0000");
    expect(movement.rows[0]?.qty_out).toBe("2.5000");
    expect(movement.rows[0]?.qty_base).toBe("-2.5000");
    expect(movement.rows[0]?.reference_type).toBe("inventory_count");
    expect(movement.rows[0]?.reference_id).toBe(inventoryCountId);

    const postedHeader = await client.query<{ status: string; posted_at: string | null }>(
      `SELECT status, posted_at::text
         FROM public.inventory_counts
        WHERE id = $1::uuid`,
      [inventoryCountId]
    );

    expect(postedHeader.rows[0]?.status).toBe("POSTED");
    expect(postedHeader.rows[0]?.posted_at).toBeTruthy();
  });

  it("rejects second post attempt for idempotency", async () => {
    if (!dbReady || !featureReady) return;

    const { companyId, itemId } = await createCompanyAndItem(client, "INV-IDEMP");

    const insertedCount = await client.query<{ id: string }>(
      `INSERT INTO public.inventory_counts (company_id, status, counted_at)
       VALUES ($1::uuid, 'DRAFT', now())
       RETURNING id`,
      [companyId]
    );

    const inventoryCountId = insertedCount.rows[0]?.id;
    expect(inventoryCountId).toBeTruthy();

    await client.query(
      `INSERT INTO public.inventory_count_lines (
        company_id,
        inventory_count_id,
        item_id,
        system_qty_base,
        counted_qty_base
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, 3, 5)`,
      [companyId, inventoryCountId, itemId]
    );

    await client.query(`SELECT public.post_inventory_count($1::uuid, NULL::uuid)`, [inventoryCountId]);

    await expect(
      client.query(`SELECT public.post_inventory_count($1::uuid, NULL::uuid)`, [inventoryCountId])
    ).rejects.toThrow(/postado|cancelado|movimentos/i);
  });
});
