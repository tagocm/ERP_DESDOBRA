# Antigravity Guardrails

To maintain repository hygiene and prevent unauthorized configuration changes, the following rules MUST be followed by any AI agent working on this codebase.

## 1. Prohibited Files (by Default)

The following files are CRITICAL INFRASTRUCTURE and should NOT be modified without explicit justification and a requested review in the implementation plan:

- `.gitignore`
- `eslint.config.mjs`
- `tsconfig.json`
- `package.json`
- `package-lock.json`
- `supabase/migrations/**` (except when creating new logic)
- Database RLS rules

## 2. Infrastructure Change Policy

If a change to any of the above files is absolutely necessary:

1.  **Justify**: Explain clearly why the change is required and what the alternatives were.
2.  **Show Diff**: Provide a clear diff of the proposed changes.
3.  **Request Review**: Explicitly ask the user to review these changes before proceeding with execution.

## 3. Hygiene Maintenance

- **No Junk**: Never stage build caches (`.next/`, `dist/`), environment files (`.env*`), local artifacts, or temporary logs.
- **Strict Linting**: Always ensure `npm run lint` and `npx tsc --noEmit` pass with zero ERRORS before finalizing any task.
- **Commit Discipline**: Keep commits small (1-3 files) and focused on code changes, not broad refactors or reformatting.

## 4. Prohibited Artifacts

The following patterns must NEVER be versioned or staged:
- `node_modules/`
- `.next/`
- `.env.local`
- `artifacts/`
- `reports/`
- `tsconfig.tsbuildinfo`
- `.DS_Store`
- `*.log`
- `lint_output.txt`
- `lint_report.txt`
