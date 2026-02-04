# P1 RLS/Storage Audit (DB Alignment)

Date: 2026-02-03
Scope: RLS + Storage alignment and missing notifications schema/policies.

## Summary
This audit focused on three inconsistency classes called out in the P1 scope:
1) Storage path contract mismatch with RLS policies.
2) Policies/functions referencing `company_members.user_id` while the schema uses `auth_user_id`.
3) Missing or incomplete `user_notifications` table and RLS policies.
4) Legacy `company_users` references in Sales NF-e policies.
5) `sales_rep_id` FK mismatch (`auth.users` vs `public.users`).

## Findings

### 1) Storage path contract mismatch
**Evidence**
- App code writes to Storage paths using `companies/<company_id>/...`:
  - `lib/upload-helpers.ts` uses `companies/${companyId}/logo/...` and `companies/${companyId}/certs/a1/...`.
- Existing policies in `20251222002623_company_settings_and_storage.sql` authorize using `(storage.foldername(name))[1]::uuid` which assumes the first path segment is a UUID (i.e., `<company_id>/...`).

**Impact**
Authenticated users uploading/reading via the UI can be denied by RLS because the first folder is `companies`, not a UUID.

**Fix**
Standardize Storage RLS to use a helper that parses `companies/<uuid>/...`, while also accepting legacy `<uuid>/...` paths for backwards compatibility.

### 2) `company_members.user_id` vs `auth_user_id`
**Evidence**
- `20251222010000_company_assets_management.sql` defines `public.is_company_member_for_path` and checks `cm.user_id = auth.uid()`. The schema defines `company_members.auth_user_id` as the user FK.

**Impact**
Membership checks can fail, denying Storage access even for valid users.

**Fix**
Ensure the helper uses `public.is_member_of(company_id)` (which checks `auth_user_id`) and standardize Storage policies to call the helper.

### 3) Missing `user_notifications` schema & policies
**Evidence**
- No `user_notifications` table or policies exist in `supabase/migrations/`.
- No SQL references found in the repo.

**Impact**
Any app or backend feature relying on user notifications would be blocked by missing schema or lack of RLS policies.

**Fix**
Create `public.user_notifications` with FK to `auth.users` and RLS policies allowing users to manage their own notifications within their company.

### 4) Legacy `company_users` in Sales NF-e policies
**Evidence**
- `20251223220000_create_sales_orders.sql` defines `sales_document_nfes` policies using `company_users` (nonexistent in current schema).
- `20260105151500_fix_all_rls_policies.sql` updates Sales Documents/Items/Payments but explicitly skips NF-es.

**Impact**
Users may be blocked from reading/writing NF-e records due to policies referencing a missing table.

**Fix**
Drop legacy policies on `sales_document_nfes` and recreate using `company_members` with a document-based check.

### 5) `sales_rep_id` FK mismatch (`auth.users` vs `public.users`)
**Evidence**
- `20251223220000_create_sales_orders.sql` defines `sales_rep_id` referencing `auth.users`.
- App code embeds `sales_rep:users!sales_rep_id(...)` (expects FK to `public.users`).
- `20260104242000_fix_sales_user_fk.sql` only adds a FK to `public.users` if no FK exists, so a prior FK to `auth.users` persists.

**Impact**
PostgREST embeds can fail or return empty if the FK points to `auth.users` instead of `public.users`.

**Fix**
Drop FK referencing `auth.users` (if present) and ensure FK to `public.users`.

## Proposed Migrations
- `supabase/migrations/20260203100000_fix_storage_rls_policies.sql`
  - Updates `is_company_member_for_path` to accept `companies/<uuid>/...` (and legacy `<uuid>/...`).
  - Drops legacy Storage policies and recreates standardized policies using the helper.
- `supabase/migrations/20260203102000_create_user_notifications.sql`
  - Creates `public.user_notifications` with FKs and RLS policies.
- `supabase/migrations/20260203103000_fix_sales_document_nfes_rls.sql`
  - Recreates `sales_document_nfes` policies to use `company_members` via `sales_documents`.
- `supabase/migrations/20260203104000_fix_sales_rep_fk.sql`
  - Drops FK to `auth.users` (if any) and ensures FK to `public.users`.
- `supabase/migrations/20260204110000_harden_public_function_exec_grants.sql`
  - Revokes default `PUBLIC/anon` EXECUTE on `public` functions.
  - Re-grants allowlisted RPCs for `authenticated` and all functions for `service_role`.
- `supabase/migrations/20260204111000_revoke_unaccent_anon.sql`
  - Attempts to revoke `PUBLIC/anon` EXECUTE on `unaccent*` extension functions (requires owner privileges).

## Risk Assessment
- Storage policy changes may affect any client writing to legacy paths. Mitigation: helper accepts both `companies/<uuid>/...` and `<uuid>/...`.
- `user_notifications` insertion policy allows authenticated users to insert their own notifications. If we want only service_role to create notifications, remove the INSERT policy (follow-up decision).
- Changing `sales_rep_id` FK can affect PostgREST relationships; ensure `public.users` contains matching IDs for reps.
- Public function hardening can break any RPC not in the allowlist. Mitigation: we allowlisted all RPCs used by the app; any external integrations need to be added explicitly.

## Exception: `unaccent*` grants
- `unaccent`, `unaccent_init`, `unaccent_lexize` are owned by `supabase_admin` and still show `anon` EXECUTE grants.
- SQL Editor runs as `postgres` and cannot revoke those grants; `SET ROLE supabase_admin` is denied.
- Risk is low (text normalization only, no data access). Removal requires support or owner-level execution.

## Rollout Plan
1) Apply migrations in staging.
2) Run the validation checklist below.
3) Validate UI flows that upload logos/certificates.
4) Deploy to production after staging validation.

## Manual Validation Checklist (SQL)

Storage policies:
1) Inspect storage policies:
   ```sql
   select policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
   order by policyname;
   ```
2) Confirm helper function definition:
   ```sql
   select proname, prosrc
   from pg_proc
   where proname = 'is_company_member_for_path';
   ```

`user_notifications`:
1) Confirm table and columns:
   ```sql
   select column_name, data_type, is_nullable
   from information_schema.columns
   where table_schema = 'public' and table_name = 'user_notifications'
   order by ordinal_position;
   ```
2) Confirm RLS enabled and policies exist:
   ```sql
   select relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_notifications';

   select policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname = 'public' and tablename = 'user_notifications'
   order by policyname;
   ```

3) Optional end-to-end test (as authenticated user):
   ```sql
   -- requires setting JWT claims in your SQL session
   set local role authenticated;
   set local request.jwt.claim.sub = '<auth_user_id>';

   insert into public.user_notifications (company_id, auth_user_id, title, body)
   values ('<company_id>', '<auth_user_id>', 'Test', 'Hello');

   select * from public.user_notifications where auth_user_id = auth.uid();
   ```

Sales NF-e RLS + sales_rep_id FK:
1) Confirm `sales_document_nfes` policy exists and uses company_members:
   ```sql
   select policyname, cmd, qual, with_check
   from pg_policies
   where schemaname = 'public' and tablename = 'sales_document_nfes'
   order by policyname;
   ```

Public function grants:
1) Confirm `anon` has no EXECUTE on `public` functions (except `unaccent*`):
   ```sql
   select routine_schema, routine_name
   from information_schema.role_routine_grants
   where grantee = 'anon' and routine_schema = 'public';
   ```
2) Confirm allowlisted functions for `authenticated`:
   ```sql
   select routine_name
   from information_schema.role_routine_grants
   where grantee = 'authenticated'
     and routine_schema = 'public'
     and routine_name in (
       'get_route_product_aggregation',
       'register_production_entry',
       'cleanup_user_drafts',
       'deduct_stock_from_route',
       'get_next_sku',
       'is_member_of',
       'has_company_role',
       'is_company_member_for_path'
     )
   order by routine_name;
   ```
2) Confirm `sales_rep_id` FK targets `public.users`:
   ```sql
   select tc.constraint_name, ccu.table_schema, ccu.table_name
   from information_schema.table_constraints tc
   join information_schema.key_column_usage kcu
     on tc.constraint_name = kcu.constraint_name
    and tc.table_schema = kcu.table_schema
   join information_schema.constraint_column_usage ccu
     on tc.constraint_name = ccu.constraint_name
    and tc.table_schema = ccu.table_schema
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and tc.table_name = 'sales_documents'
     and kcu.column_name = 'sales_rep_id';
   ```

## Follow-ups (if needed)
- If any UI or server code assumes different Storage paths, notify Agent 1. Current audit found `companies/<uuid>/...` in `lib/upload-helpers.ts`, which now matches the updated RLS helper.
