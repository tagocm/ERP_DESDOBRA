# Diagnostics Report
Date: 2025-12-30T16:13:33.756Z
Node Version: v20.19.6

## Environment Check
```

> erp-desdobra@0.1.0 diag:env
> tsx scripts/diagnostics/env.ts

--- Env Diagnostic ---
.env.local exists: true
DATABASE_URL: Not found in .env.local
NEXTAUTH_URL: Not found in .env.local
NEXTAUTH_SECRET: Not found in .env.local
JWT_SECRET: Not found in .env.local
NODE_ENV: Not found in .env.local
----------------------

```

## Port Check
```

> erp-desdobra@0.1.0 diag:ports
> tsx scripts/diagnostics/ports.ts

--- Port Diagnostic ---
No Node.js processes found listening on TCP.
[INFO] Port 3000 is free.
[INFO] Port 3001 is free.
[INFO] Port 8080 is free.
-----------------------

```

## Build Status
Skipped (use --build to run)

## HTTP Check
```

> erp-desdobra@0.1.0 diag:http
> tsx scripts/diagnostics/http.ts

--- HTTP Diagnostic ---
[SKIP] Port 3000 is closed.
[SKIP] Port 3001 is closed.
[SKIP] Port 8080 is closed.
-----------------------

```

## Conclusion
- See sections above for details.
