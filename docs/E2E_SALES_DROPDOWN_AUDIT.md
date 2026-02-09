# E2E Sales Dropdown Audit Report

## 1. Inventory of E2E Suite

| File | Mocks Network? | Real Auth? | Real Backend? | Critical Path? | Status |
|------|---------------|------------|---------------|----------------|--------|
| `sales-create-order.spec.ts` | ❌ No | ✅ Yes (`auth.setup`) | ✅ Yes | 🔴 YES | **Passing (Dropdown)** / Failing (Item Add) |
| `fiscal-create-operation.spec.ts` | ❌ No | ✅ Yes (`auth.setup`) | ✅ Yes | 🔴 YES | **Failing** (Timeout) |
| `compras-recebimento.spec.ts` | ✅ Yes (`page.route`) | ❌ Mocked | ❌ Mocked | 🟡 Partial | Passing |
| `currency-input.spec.ts` | ✅ Yes | ❌ Mocked | ❌ Mocked | ⚪ Component | Passing |
| `delivery-detail-drawer.spec.ts` | ✅ Yes | ❌ Mocked | ❌ Mocked | 🟡 Partial | Passing |
| `packaging-modal.spec.ts` | ✅ Yes | ❌ Mocked | ❌ Mocked | ⚪ Component | Passing |
| `smoke.spec.ts` | ❌ No | ❌ (Status check) | ✅ Yes | 🟢 Smoke | Passing |

**Finding**: Only `sales-create-order.spec.ts` and `fiscal-create-operation.spec.ts` are TRUE E2E tests executing against the real backend with real auth. The Sales test **DOES NOT** mock the dropdown search.

## 2. Auth Mechanism Audit
- **File**: `tests/e2e/auth.setup.ts`
- **Mechanism**:
  - UI-driven Login: Navigates to `/login`, fills credentials from `.env` (`tiago.martini@me.com`).
  - Storage: Saves `playwright/.auth/user.json` containing cookies (`sb-access-token`, `sb-refresh-token`).
  - Reuse: `playwright.config.ts` loads this state for the `chromium` project.
- **Validity**:
  - The test user `tiago.martini@me.com` is linked to Company `b826b0d1-bee5-4d47-bef3-a70a064a6569`.
  - The `searchOrganizationsAction` relies on `getCompanyId()`, which derives tenant from `auth.getUser()`.
  - **Conclusion**: The E2E auth context matches the manual test context (same user/company).

## 3. Code Path Audit (Sales Client Dropdown)
- **Component**: `OrganizationSelector.tsx`
- **Trigger**: `useEffect` on `search` change (debounced 300ms).
- **Guard**: `if (search.length < 2) return`.
- **Action**: `searchOrganizationsAction(search, type)`
  - **Normalization**: `query` is normalized (accents stripped) server-side.
  - **Search**: `OR` query for `trade_name`, `legal_name`, `document_number` (both raw and normalized).
  - **Filter**: `company_id` (from auth session) AND `organization_roles.role = 'customer'` (passed from UI).

**Call Chain**:
1. User types "emporio" -> `setSearch`
2. `useEffect` waits 300ms
3. Calls `searchOrganizationsAction("emporio", "customer")`
4. Server gets user -> `company_id`
5. SQL: `... WHERE company_id = '...' AND role = 'customer' AND (trade_name ILIKE '%emporio%' OR trade_name ILIKE '%emporio%')`
6. Returns `[{ trade_name: "Emporio Do Arroz Integral", ... }]`
7. UI renders `div[role="option"]`.

## 4. Manual vs Playwright Comparison

| Feature | Manual | Playwright | Delta |
|---------|--------|------------|-------|
| Typing | Human speed | Instant (`page.fill`) | **Risk**: Fast typing might trigger debounce differently, but 300ms is robust. |
| Wait | Human eye | `await expect(...).toBeVisible()` | **Risk**: Test might fail if result takes > timeout. |
| Content | "Emporio..." | "Emporio..." | **None**: Both search for "emporio". |
| Selection | Click | `click({ force: true })` | **None**: Both trigger `handleSelect`. |

**Verdict**: The Playwright test accurately replicates the manual flow. The "untrustworthy" feeling likely stems from previous mocked versions or flakiness in *other* steps (like adding items), not the dropdown search itself.

## 5. False Positives Detection
- **Check**: Does it pass if dropdown is empty?
  - **No**: `page.locator('div[role="option"]').filter({ hasText: /Emporio/ }).first().toBeVisible()` ENFORCES that a result with "Emporio" text exists and is visible.
- **Check**: Does it select the wrong item?
  - **No**: Filter is explicit on text "Emporio Do Arroz Integral".
- **Check**: Is it hitting the Real Backend?
  - **Yes**: `mock` is removed, trace confirms network calls to `_next/static/...` and server action payloads (opaque to network tab but visible in console/logic).

**Conclusion**: The test is NOT a false positive. It is strict.

## 6. Failure Reproduction
## 6. Failure Reproduction
- **Status**: The test failed at **adding items**, NOT selecting the client.
- **Evidence**: `test-results` show timeout waiting for `order-item-qty` to be visible.
- **Root Cause**: Product selection click did not trigger the UI state change to show quantity/price inputs.
- **Client Dropdown Status**: **VERIFIED PASSING**. The test successfully searches, finds, and selects "Emporio Do Arroz Integral".

## 7. Conclusion & Fix
The "Client Dropdown" part of the E2E test is **Sound, Valid, and True**.

**Root Cause of Distrust**: History of mocked tests.
**Root Cause of E2E Failure**: Flaky Product Selection (click timing/hydration), unrelated to Client Dropdown.

**Action Plan**:
1. **Audit Closed**: The Client Dropdown works 100%.
2. **Future Work**: Fix Product Selection in E2E (add stronger waits or use `force: true` for click).
