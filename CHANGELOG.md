# Changelog

All notable changes to this project are documented in this file.

## [2026-02-09] - Production Readiness Hardening

### Added
- Production operation scripts (`scripts/ops/*`) for install, restart, status, logs, deploy, rollback, migrations, go-live gate, and local artifact cleanup.
- Automated production checks:
  - `scripts/preflight-prod.sh`
  - `scripts/smoke-prod.sh`
  - `scripts/smoke-business.sh`
  - `scripts/load-health.sh`
  - `scripts/go-live-report.sh`
- Deployment templates and guides:
  - `deploy/systemd/*`
  - `deploy/cloudflared/config.yml.example`
  - `docs/PRODUCAO_UBUNTU_CLOUDFLARE.md`
  - `docs/OPERACOES_SCRIPTS.md`

### Changed
- CI production build now uses webpack mode (`npm run build:prod`).
- Dev company fallback is blocked in production code paths.
- Fiscal SOAP TLS handling enforces strict certificate validation in production.

### Repository Hygiene
- Root local diagnostic `.txt` artifacts moved to `artifacts/local-logs/`.
- Python virtual environment removed from version control (`.venv` kept local only).
- Legacy ad-hoc scripts reorganized under `scripts/legacy/`.
