# Database Reset Guide

This project includes a unified command to reset the development database, apply migrations, and seed initial data.

## Prerequisites
- **Docker** must be running (Supabase local development requirement).
- **Supabase CLI** must be installed (or used via `npx`).

## Command
Run the following command in your terminal:

```bash
npm run db:reset
```

## What this does
1.  **Reset**: Truncates/Drops local database tables.
2.  **Migrate**: Applies all SQL migration files from `supabase/migrations`.
3.  **Seed**: Runs `supabase/seed.sql` to populate:
    -   Company: "Martigran"
    -   User: "Admin Local"
    -   Products: Granito (m2), Bloco (m3), Resina (un)
    -   Client: "Construtora Exemplo"
    -   Order: #100100 (ready for logistics testing)

## Troublshooting
-   **Docker Error**: If you see `Cannot connect to the Docker daemon`, ensure Docker Desktop is open and running.
-   **Permissions**: Ensure you have permission to write to the local database volumes if issues persist.
