# ERP_DESDOBRA

ERP system for managing marble/granite production, sales, and logistics.

## 🔁 Webhook Test Marker

Last webhook test update: 2026-02-10.

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/tagocm/ERP_DESDOBRA.git
    cd ERP_DESDOBRA
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Copy `.env.example` to `.env.local` and configure the required variables.
    ```bash
    cp .env.example .env.local
    ```

    **Key Environment Variables:**
    - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public API Key.
    - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (for server-side admin tasks).
    - `NFE_ENVIRONMENT`: `homologacao` or `producao` (for fiscal/NFe).
    - `SEFAZ_CA_BUNDLE_PATH`: Path to CA bundle (default: `certs/sefaz-ca-bundle.pem`).

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`.

## 🛠 Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the application for production. |
| `npm run start` | Starts the production server. |
| `npm run lint` | Runs ESLint to check for code quality issues. |
| `npm run ui:check` | Checks UI component integrity (custom script). |
| `npm run test` | Runs unit tests using Vitest. |
| `npm run test:e2e` | Runs E2E tests using Playwright (headless). |
| `npm run test:e2e:ui` | Runs E2E tests with interactive UI. |
| `npm run test:e2e:headed` | Runs E2E tests in headed mode (see browser). |
| `npm run test:e2e:debug` | Runs E2E tests in debug mode. |
| `npx supabase db reset` | Resets the local database (seeds, schema). |

## 📥 NF-e de Entrada (Distribuição DF-e)

### Componentes entregues

- Banco: tabelas `fiscal_dfe_sync_state`, `fiscal_inbound_dfe`, `fiscal_inbound_manifest_events` com RLS, índices e RPCs idempotentes.
- Worker: novos jobs `NFE_DFE_DIST_SYNC` e `NFE_DFE_MANIFEST_SEND` no mesmo processo do fiscal.
- Scheduler: enfileira sincronização DF-e a cada 10 minutos por empresa configurada.
- UI: aba **Notas de Entrada** com filtros, tabs, download XML, geração/print DANFE e manifestação.
- APIs:
  - `POST /api/fiscal/inbound/sync`
  - `GET /api/fiscal/inbound/list`
  - `GET /api/fiscal/inbound/events`
  - `GET /api/fiscal/inbound/:id/xml`
  - `GET /api/fiscal/inbound/:id/danfe.pdf`
  - `POST /api/fiscal/inbound/:id/manifest`

### Configuração de provider/certificado

1. Configure certificado A1 na empresa (`company_settings`) como já feito para emissão NF-e.
2. Defina provider DF-e:
   - `NFE_DFE_PROVIDER=auto` (default, usa provider real)
   - `NFE_DFE_PROVIDER=stub` (simulação local)
3. Configure variáveis de TLS/diagnóstico:
   - `SEFAZ_CA_BUNDLE_PATH=/opt/erp-desdobra/certs/sefaz-ca-bundle.pem`
   - `SEFAZ_DEBUG=true` (para exibir host/path/serviço e metadados do bundle)
4. Opcional para simulação local:
   - `NFE_DFE_STUB_DOCS_JSON=[{\"nsu\":\"1\",\"schema\":\"resNFe\",\"xmlBase64\":\"...\"}]`

#### Bundle de CA (cadeia completa)

- O arquivo em `SEFAZ_CA_BUNDLE_PATH` deve conter cadeia PEM completa (`-----BEGIN CERTIFICATE-----`), incluindo intermediárias quando necessário.
- O worker valida no startup: caminho, leitura, quantidade de certificados e SHA256 (não imprime conteúdo do certificado).
- Se o bundle custom falhar no handshake TLS, o client tenta **uma única vez** fallback para trust store do sistema mantendo verificação TLS ativa.

### Execução

1. Rode o worker:
   ```bash
   npm run worker:start
   ```
2. Use **Sincronizar agora** na aba de entrada ou chame:
   ```bash
   curl -X POST http://localhost:3000/api/fiscal/inbound/sync \
     -H 'Content-Type: application/json' \
     -d '{"environment":"homologation"}'
   ```

### Troubleshooting rápido

- Nenhum documento aparece:
  - Verifique se o worker está ativo e consumindo `NFE_DFE_DIST_SYNC`.
  - Confira `company_settings.nfe_environment` e status em `fiscal_dfe_sync_state`.
- XML/PDF indisponível:
  - O documento ainda pode estar em resumo (`has_full_xml=false`).
  - Rode sincronização novamente e valide `xml_base64` na `fiscal_inbound_dfe`.
- Manifestação não sai de pendente:
  - Verifique fila `NFE_DFE_MANIFEST_SEND` e coluna `last_error` em `fiscal_inbound_manifest_events`.
- Erro TLS `unable to get local issuer certificate`:
  - Confirme `SEFAZ_CA_BUNDLE_PATH` e a cadeia do arquivo.
  - Verifique no log os campos `host`, `path`, `service` e SHA256 do bundle.
  - Para `NFeDistribuicaoDFe` (`www1.nfe.fazenda.gov.br` / `hom.nfe.fazenda.gov.br`), o worker usa trust store do sistema (`ca` nativo do Node) e ignora `SEFAZ_CA_BUNDLE_PATH` para evitar cadeia incorreta.
  - Se `NODE_EXTRA_CA_CERTS` estiver definido, o log indica `caSource=node-extra-ca-certs`.
  - O scheduler aplica cooldown de 1 hora para erro TLS e evita re-enfileiramento agressivo.

Diagnóstico rápido do endpoint de distribuição (Node 20):

```bash
node --import tsx scripts/diagnose-sefaz-dist-tls.ts
```

Saída esperada (resumo):
- `caSource=system-trust-store` ou `caSource=node-extra-ca-certs` para distribuição.
- sucesso HTTP ou erro TLS explícito com `code/message`.
- versão do Node/OpenSSL usada no teste.

Modo diagnóstico single-shot (1 job = 1 consulta DF-e):

```bash
NFE_DFE_DIST_SINGLE_SHOT=true npm run worker:start
```

Com a flag ativa, o sync de distribuição processa apenas a primeira resposta da SEFAZ por job (sem paginação adicional no mesmo job).

Exemplo de log esperado com `SEFAZ_DEBUG=true`:

```text
[SEFAZ] CA bundle validado no startup. { resolvedPath: '/opt/erp-desdobra/certs/sefaz-ca-bundle.pem', sizeBytes: 182345, certificateCount: 4, sha256: '9f...ab' }
[SEFAZ-DIAGNOSTIC] Endpoint host=www1.nfe.fazenda.gov.br path=/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx service=NFeDistribuicaoDFe
[SEFAZ-DIAGNOSTIC] Agent CA source=env path=/opt/erp-desdobra/certs/sefaz-ca-bundle.pem bytes=182345 certs=4 sha256=9f...ab
[NFE_DFE_DIST_SYNC] Lote processado { page: 1, fetched: 50, inserted: 50, updated: 0, nextNsu: '000000000123456' }
```

## 🧪 Testing

### Unit Tests

This project uses Vitest for unit testing:

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### E2E Tests

End-to-end tests use Playwright to validate critical user flows and React Hooks fixes:

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with interactive UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

**Test Coverage:**

E2E tests validate that React Hooks lint fixes don't introduce regressions:
- **Race conditions:** Rapid state changes (company switching)
- **Unmount scenarios:** setState after unmount prevention
- **Prop synchronization:** CurrencyInput value updates
- **State isolation:** PackagingModal state between opens

See [`tests/e2e/`](./tests/e2e/) for test specifications.

## 🐳 Production Login (Docker)

If you deploy with Docker + reverse proxy, see:

- [`docs/LOGIN_DOCKER_TROUBLESHOOTING.md`](./docs/LOGIN_DOCKER_TROUBLESHOOTING.md)

**CI Integration:**

E2E tests run automatically in CI (GitHub Actions) on every push/PR. Test reports are uploaded as artifacts.


## 🏗 Quick Architecture

### PCP / WIP

- Modelo WIP + OP filha (1 nível) + setores mínimos: [`docs/pcp-wip-op-filha-setores.md`](./docs/pcp-wip-op-filha-setores.md)

### Core Concepts

-   **Multi-tenancy:** All data is scoped by `company_id`. Row Level Security (RLS) policies enforce this at the database level. Always include `company_id` in your queries.
-   **Soft Delete:** Most tables implement soft delete via a `deleted_at` timestamp column. Data is not physically removed; queries should filter `deleted_at is null` (handled by repository layer).
-   **Validation:** Input validation is strictly enforced using `zod` schemas for both API routes and Server Actions.

### Directory Structure

-   `app/`: Next.js App Router (pages, layouts, API routes).
-   `components/`: Reusable React components (UI library, feature-specific).
-   `lib/`:
    -   `data/`: Data access layer (repositories) wrapping Supabase queries.
    -   `actions/`: Server Actions for mutations.
    -   `fiscal/`: Logic for NFe emission and SEFAZ integration.
    -   `supabase/`: Supabase client initialization (browser/server).
-   `supabase/`: DB migrations, seeds, and config.
-   `types/`: TypeScript definitions (generated from DB schema).
-   `scripts/`: Utility scripts for maintenance, diagnostics, and testing.
-   `scripts/ops/`: Production operation scripts (deploy, rollback, health, logs, go-live gate).
-   `scripts/legacy/`: Historical ad-hoc scripts kept for technical reference.

## 🔒 Security

-   **RLS:** Row Level Security is the primary defense. Ensure policies are correct for every new table.
-   **Service Role:** Only use `SUPABASE_SERVICE_ROLE_KEY` in secure server contexts (e.g., background jobs, admin actions).
-   **Internal Routes:** `/api/debug/*` and `/api/test/*` are disabled in production unless `INTERNAL_API_TOKEN` is set and provided via `x-internal-token`.
-   **Secrets:** Never commit `.pfx` certificates or `.env` files. Use `.gitignore`.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

_Commit de teste para validar push no GitHub (2026-02-10)._
