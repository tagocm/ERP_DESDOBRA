# TypeScript Type Safety Plan

**Goal**: Achieve >90% type safety in ERP_DESDOBRA by eliminating `any` usage, prioritizing CORE business logic.

**Based on**: [Any Audit Report](../reports/any-audit.md) (2026-01-30)

## Baseline Metrics (2026-01-30)

- **Total TypeScript Files**: 265
- **Files with Any**: 268
- **Total Explicit Any**: 814 instances
- **Total Type Suppressions**: 73 instances (@ts-ignore, @ts-expect-error)
- **Grand Total**: 887 type safety violations

### Distribution by Layer
- **UI (components/)**: ~490 instances (55%)
- **BORDA (lib/data, lib/fiscal, app/api)**: ~270 instances (30%)
- **CORE (app/actions)**: ~90 instances (10%) - **HIGHEST PRIORITY**
- **SCRIPTS/TOOLS**: ~1 instance (negligible)

## Remediation Plan (4 PRs)

### ✅ PR1: CORE Layer Baseline Gate (Prevent Regression)
**Status**: ✅ COMPLETE  
**Branch**: `ci/setup-workflows`  
**Goal**: Block regression of type safety in CORE business logic without breaking CI

**Strategy**: Baseline Budget Enforcement
- Created `scripts/any-budget-actions.js` that counts `any` usage in `app/actions/**`
- Baseline set to 34 instances (from 2026-01-30 audit)
- CI fails if any count exceeds baseline (prevents regression)
- Allows gradual improvement without blocking current work

**Changes**:
- Added budget check script with configurable baseline
- Integrated into `.github/workflows/ci.yml` as separate step
- ESLint remains `warn` globally (no breaking changes)
- Future PRs that reduce `any` can lower the baseline

**Before/After**:
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `app/actions` any count | 34 | 34 | 0 (frozen) |
| CI enforcement | none | **budget gate** | ✅ Regression blocked |
| ESLint errors | 0 | 0 | ✅ No breaking changes |

**CI Status**: ✅ Green - Budget check passes, no regression allowed

---

### 🔄 PR2: Fix CORE Finance Actions (High Risk, Low Volume)
**Status**: 📋 PLANNED  
**Target Files**:
- `app/actions/finance-events.ts` (15 instances)
- `app/actions/financial/*.ts` (~19 instances)
- Other critical actions

**Strategy**:
1. Replace `catch (e: any)` → `catch (e: unknown)` with type guards
2. Replace `as any` with proper types or `unknown` + narrowing
3. Use Supabase generated types where applicable
4. Remove unnecessary @ts-ignore/@ts-expect-error

**Target Reduction**: 34 → 0 instances in `app/actions/`

---

### 📋 PR3: Data Layer with Supabase Types (High ROI)
**Status**: PLANNED  
**Target Files**:
- `lib/data/sales-orders.ts` (16 instances)
- `lib/data/expedition.ts` (24 instances)
- `lib/data/boms.ts`, `lib/data/purchases.ts`, etc.

**Strategy**:
1. Generate types: `npx supabase gen types typescript --local > types/supabase.ts`
2. Create typed client helper:
   ```typescript
   // lib/supabase/typed-client.ts
   import { Database } from '@/types/supabase'
   export const createTypedClient = () => createClient<Database>()
   ```
3. Refactor top data layer files to use generated types
4. Replace `as any` with proper Supabase row types

**Target Reduction**: ~100 instances in `lib/data/`

---

### 📋 PR4: SalesOrderForm with Zod (Top UI Offender)
**Status**: PLANNED  
**Target File**: `components/sales/order/SalesOrderForm.tsx` (66 instances, 16 suppressions)

**Strategy**:
1. Create Zod schemas:
   ```typescript
   // lib/schemas/sales-order.ts
   export const SalesOrderItemSchema = z.object({ ... })
   export const SalesOrderSchema = z.object({
     items: z.array(SalesOrderItemSchema),
     ...
   })
   export type SalesOrder = z.infer<typeof SalesOrderSchema>
   ```
2. Replace all `any` with inferred Zod types
3. Remove all 16 @ts-ignore suppressions
4. Use proper generics for event handlers

**Target Reduction**: 66 → 0 instances in SalesOrderForm

---

## Progress Tracking

### Overall Progress
| Phase | Target Reduction | Cumulative Total |
|-------|------------------|------------------|
| Baseline | - | 887 |
| PR1 (Guardrails) | 0 (prevent growth) | 887 |
| PR2 (CORE) | -34 | 853 |
| PR3 (Data Layer) | -100 | 753 |
| PR4 (Top UI) | -66 | 687 |
| **Phase 1 Complete** | **-200** | **~690** |

### Long-term Goals
- **Phase 2** (4-8 weeks): Address remaining forms, API routes (~400 instances)
- **Phase 3** (8-12 weeks): Enable strict TypeScript config incrementally
- **Target State**: <100 `any` instances, all justified and documented

## Enforcement Strategy

### Current (PR1)
```javascript
// eslint.config.mjs
{
  files: ["app/actions/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error", // CORE blocked
  }
}
```

### Future Phases
- **PR2**: Verify 0 `any` in `app/actions/`
- **PR3**: Add `lib/data/**` to error enforcement after cleanup
- **PR4+**: Gradually expand strict enforcement to all layers

## CI/CD Integration

### Baseline Tracking
```bash
# Track any count per PR
grep -r ": any\|as any" --include="*.ts" --include="*.tsx" app/ lib/ components/ | wc -l
```

### Future: Automated Metrics
- GitHub Action to track and report any count on each PR
- Block PRs that increase any count in CORE
- Monthly reports on type safety progress

---

**Last Updated**: 2026-01-30 (PR1 complete)  
**Next Review**: After PR2 (CORE cleanup)
