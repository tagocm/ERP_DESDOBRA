
## Data Layer & API

This project uses a structured data layer to interact with Supabase, ensuring type safety and multi-tenancy security.

### 1. Database Types
We automatically generate Typescript definitions from the database schema.
- **Location**: `types/supabase.ts`
- **Usage**: Import `Database`, `Organization`, `Person`, etc. for type safety.

### 2. Supabase Clients
- **Browser Client**: `lib/supabase/browser.ts`
  - Safe for client-side components.
  - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Restriction**: Cannot perform admin/service-role operations.
  
- **Server Client**: `lib/supabase/server.ts`
  - **Server-Only**: Can only be imported in Server Components, Route Handlers, or Server Actions.
  - Uses `SUPABASE_SERVICE_ROLE_KEY`.
  - Bypass RLS if needed (but currently queries respect `companyId`).

### 3. Data Repositories (`lib/data/`)
Encapsulate Supabase queries to ensure consistent filtering (e.g. `company_id`, `deleted_at`).
- `organizations.ts`
- `people.ts`
- `addresses.ts`
- `tags.ts`

**Example Usage:**
```typescript
import { organizationsRepo } from '@/lib/data/organizations'

// Server-side only
const orgs = await organizationsRepo.list('company-uuid-123')
```

### 4. API Routes
We provide REST endpoints for organizations as an example of secure server-side operations.

**Endpoints:**
- `GET /api/orgs?companyId=...` - List organizations
- `POST /api/orgs` - Create organization (Body: `companyId`, `trade_name`, etc.)
- `GET /api/orgs/[id]?companyId=...` - Get details
- `PATCH /api/orgs/[id]` - Update (Body: `companyId`, fields to update)
- `DELETE /api/orgs/[id]?companyId=...` - Soft delete

**Security Note:**
All API routes validate inputs using Zod and require `companyId` to prevent cross-tenant data access.
