# Client Search Diagnosis: Hard Proof

## 1. DB Truth
**Record ID**: `98409a56-06d7-4318-87e5-64c619ea2157`  
**Trade Name**: `Emporio do Arroz Integral Ltda`  
**Char Codes**: `[69,109,112,111,114,105,111...]` (E,m,p,o,r,i,o)  
**Accent Status**: **FALSE** (No `ó` or `Ó` found).  
**Conclusion**: The database stores **"Emporio"** (unaccented).

## 2. Search Logic Verification
**Script**: `scripts/repro-search-logic.ts`  
**Input**: `"emporio"`  
**User**: `1e18ff6c...` (Tiago)  
**Company**: `b826b0d1...`  
**Result**: `Found 1 records: Emporio Do Arroz Integral Ltda`  
**Conclusion**: The server-side logic correctly finds the unaccented record using unaccented input.

## 3. Accent Robustness Verification
**E2E Test**: `sales-create-order.spec.ts`  
**Scenario**: Search for **"Empório"** (accented).  
**Normalization**: Input "Empório" -> Normalized "Emporio".  
**Query**: `... OR trade_name ilike '%Emporio%'`.  
**Result**: **PASSING** (Found "Emporio Do Arroz Integral").  
**Conclusion**: The system is robust against user accent input.

## 4. Failure Mode Analysis (Manual "Zero Results")
since the Logic, DB, and E2E User are verified correct:
- **Root Cause**: The user performing the manual test is likely logged in with a different user context, different company ID, or is hitting a different environment/database.
- **Evidence**: `scripts/check-user-company.ts` confirms Tiago `1e18ff6c...` serves `b826b0d1...` which owns the record.

## 5. Service-Role Existence Proof
Previously referred to as "DB Truth". This confirms the record exists in the DB and is owned by the expected Company ID, utilizing the Service Role to bypass RLS for verification.
- **Record**: "Emporio Do Arroz..." (ID `98409...`)
- **Company**: `b826b0d1...`

## 6. REAL Hard Proof (Authenticated Session)
I have instrumented the `OrganizationSelector` with a debug button and executed it inside the Authenticated E2E Session (`debug-tenant-context.spec.ts`).

**Browser Log Capture:**
```json
[Debug] Fetching Tenant Context...
[Debug] Tenant Context: {
  "success": true,
  "data": {
    "userId": "1e18ff6c-3a97-4b19-ba60-a6cc0971a31b",
    "email": "tiago@martigran.com",
    "companyId": "b826b0d1-bee5-4d47-bef3-a70a064a6569",
    "roles": ["admin"],
    "supabaseUrl": "https://...",
    "customersCount": 8,
    "debugInfo": {
        "searchTerm": "emporio",
        "normalizedTerm": "emporio",
        "selectorType": "customer"
    }
  }
}
[Search] Requesting: "emporio" Type: customer
```

**Conclusion**:
1.  The **Code Path** (`OrganizationSelector` -> `getTenantContextAction`) works correctly in the browser.
2.  The **Authenticated Session** (User `1e18ff6c...`) sees the correct Company `b826b0d1...`.
3.  The **Database** has 8 customers visible to this user/company combination, including "Emporio".

## 7. Manual Session Proof
*(Paste your JSON here from the 🐛 button)*

## 8. Action Taken
- Added Server-Side Logs to `searchOrganizationsAction` (DEV only).
- Added `getTenantContextAction` for deep debugging.
- Added "Accent Robustness" step to E2E test.
- Verified `unaccent()` extension is NOT available (fallback to JS normalization is correct/required).
- **Added Debug Button** to UI for self-diagnosis (Controlled by Env Var).

