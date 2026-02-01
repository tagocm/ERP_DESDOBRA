# ERP_DESDOBRA

ERP system for managing marble/granite production, sales, and logistics.

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

**CI Integration:**

E2E tests run automatically in CI (GitHub Actions) on every push/PR. Test reports are uploaded as artifacts.


## 🏗 Quick Architecture

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

## 🔒 Security

-   **RLS:** Row Level Security is the primary defense. Ensure policies are correct for every new table.
-   **Service Role:** Only use `SUPABASE_SERVICE_ROLE_KEY` in secure server contexts (e.g., background jobs, admin actions).
-   **Secrets:** Never commit `.pfx` certificates or `.env` files. Use `.gitignore`.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
