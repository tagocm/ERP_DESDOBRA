import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const dbUrl = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let client: Client;
let dbReady = true;

function buildSlug(prefix: string, id: string): string {
  return `${prefix}-${id.slice(0, 8)}`;
}

describe("fiscal inbound DF-e RPCs (integration)", () => {
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
    await client.query("BEGIN");
  });

  afterEach(async () => {
    if (!dbReady) return;
    await client.query("ROLLBACK");
  });

  it("set_dfe_sync_running + set_dfe_sync_result update state deterministically", async () => {
    if (!dbReady) return;

    const companyId = randomUUID();
    await client.query(
      "INSERT INTO public.companies (id, name, slug) VALUES ($1::uuid, $2::text, $3::text)",
      [companyId, "Empresa Sync", buildSlug("sync", companyId)],
    );

    const running = await client.query<{
      status: string;
      last_nsu: string;
      environment: string;
    }>(
      `SELECT s.status, s.last_nsu, s.environment
         FROM public.set_dfe_sync_running($1::uuid, $2::text) AS s`,
      [companyId, "homologation"],
    );

    expect(running.rows[0]?.status).toBe("RUNNING");
    expect(running.rows[0]?.last_nsu).toBe("0");
    expect(running.rows[0]?.environment).toBe("homologation");

    const finished = await client.query<{
      status: string;
      last_nsu: string;
      last_error: string | null;
    }>(
      `SELECT s.status, s.last_nsu, s.last_error
         FROM public.set_dfe_sync_result($1::uuid, $2::text, $3::text, $4::text, $5::text) AS s`,
      [companyId, "homologation", "000000000000007", "IDLE", null],
    );

    expect(finished.rows[0]?.status).toBe("IDLE");
    expect(finished.rows[0]?.last_nsu).toBe("000000000000007");
    expect(finished.rows[0]?.last_error).toBeNull();
  });

  it("upsert_inbound_dfe_batch counts insert/update and preserves idempotence by NSU", async () => {
    if (!dbReady) return;

    const companyId = randomUUID();
    await client.query(
      "INSERT INTO public.companies (id, name, slug) VALUES ($1::uuid, $2::text, $3::text)",
      [companyId, "Empresa Batch", buildSlug("batch", companyId)],
    );

    const firstBatch = [
      {
        nsu: "000000000000101",
        schema: "resNFe",
        chnfe: "35260203645616000108550010000085801632496383",
        emit_cnpj: "03645616000108",
        emit_nome: "Fornecedor A",
        dest_cnpj: "09506351000143",
        dh_emi: "2026-03-05T10:00:00-03:00",
        total: "199.90",
        summary_json: { tipo: "resumo" },
        has_full_xml: false,
      },
    ];

    const first = await client.query<{ inserted_count: number; updated_count: number }>(
      "SELECT * FROM public.upsert_inbound_dfe_batch($1::uuid, $2::text, $3::jsonb)",
      [companyId, "homologation", JSON.stringify(firstBatch)],
    );

    expect(first.rows[0]?.inserted_count).toBe(1);
    expect(first.rows[0]?.updated_count).toBe(0);

    const secondBatch = [
      {
        nsu: "000000000000101",
        schema: "procNFe",
        chnfe: "35260203645616000108550010000085801632496383",
        summary_json: { tipo: "processada" },
        xml_base64: Buffer.from("<NFe>conteudo</NFe>", "utf8").toString("base64"),
        has_full_xml: true,
      },
    ];

    const second = await client.query<{ inserted_count: number; updated_count: number }>(
      "SELECT * FROM public.upsert_inbound_dfe_batch($1::uuid, $2::text, $3::jsonb)",
      [companyId, "homologation", JSON.stringify(secondBatch)],
    );

    expect(second.rows[0]?.inserted_count).toBe(0);
    expect(second.rows[0]?.updated_count).toBe(1);

    const row = await client.query<{
      schema: string;
      has_full_xml: boolean;
      xml_base64: string | null;
    }>(
      `SELECT schema, has_full_xml, xml_base64
         FROM public.fiscal_inbound_dfe
        WHERE company_id = $1::uuid
          AND environment = 'homologation'
          AND nsu = '000000000000101'`,
      [companyId],
    );

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]?.schema).toBe("procNFe");
    expect(row.rows[0]?.has_full_xml).toBe(true);
    expect(row.rows[0]?.xml_base64).not.toBeNull();
  });

  it("enqueue_manifest_event is idempotent by company/environment/chNFe/event_type", async () => {
    if (!dbReady) return;

    const companyId = randomUUID();
    await client.query(
      "INSERT INTO public.companies (id, name, slug) VALUES ($1::uuid, $2::text, $3::text)",
      [companyId, "Empresa Manifest", buildSlug("manifest", companyId)],
    );

    const first = await client.query<{ id: string; status: string }>(
      "SELECT s.id, s.status FROM public.enqueue_manifest_event($1::uuid, $2::text, $3::text, $4::text, $5::text) AS s",
      [
        companyId,
        "production",
        "35260203645616000108550010000085801632496383",
        "CIENCIA",
        null,
      ],
    );

    const second = await client.query<{ id: string; status: string }>(
      "SELECT s.id, s.status FROM public.enqueue_manifest_event($1::uuid, $2::text, $3::text, $4::text, $5::text) AS s",
      [
        companyId,
        "production",
        "35260203645616000108550010000085801632496383",
        "CIENCIA",
        null,
      ],
    );

    expect(first.rows[0]?.id).toBe(second.rows[0]?.id);
    expect(second.rows[0]?.status).toBe("PENDING");

    const count = await client.query<{ qty: number }>(
      `SELECT COUNT(*)::int AS qty
         FROM public.fiscal_inbound_manifest_events
        WHERE company_id = $1::uuid
          AND environment = 'production'
          AND chnfe = '35260203645616000108550010000085801632496383'
          AND event_type = 'CIENCIA'`,
      [companyId],
    );

    expect(count.rows[0]?.qty).toBe(1);
  });
});
