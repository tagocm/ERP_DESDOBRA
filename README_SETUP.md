
## Local Development Setup

To run this project locally, you need to configure your environment variables and ensure any necessary certificates are in place.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Required variables typically include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)
- `DATABASE_URL` (for migrations/direct DB access)

### Certificates

For SEFAZ integration (NFe), you might need an SSL certificate (PFX/P12) and the SEFAZ CA bundle.

- **CA Bundle**: Included at `certs/sefaz-ca-bundle.pem`.
- **Client Certificate**: If required, place your `.pfx` or `.p12` file in `certs/` but **DO NOT COMMIT IT**. The `.gitignore` is configured to ignore these files.

### Repository Cleanup

The repository is configured to ignore artifact files, logs, and temporary backups. If you need to generate these (e.g., SQL dumps, logs), they should be placed in:
- `artifacts/sql/`
- `artifacts/logs/`
- `artifacts/backups/`
- `tmp/`

These directories are ignored by git.
