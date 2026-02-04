# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v0.x    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to security@erpdesdobra.com. All security vulnerabilities will be promptly addressed.

Please do not report security vulnerabilities through public GitHub issues.

## Security Best Practices in Development

- **Never commit secrets**: Check `.env` and `.env.local` are in `.gitignore`.
- **Use parameterized queries**: Supabase JS client handles this, but act with caution in raw SQL.
- **Review Row Level Security (RLS)**: Ensure new tables have RLS policies enabled.
- **Validate Inputs**: Always use `zod` schemas for API and server action inputs.
