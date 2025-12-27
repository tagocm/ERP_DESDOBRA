# Company Assets & Certificate Management - Setup Guide

## Overview

This implementation adds secure logo and A1 digital certificate management to the ERP system with encrypted password storage.

## Features

- **Logo Upload**: Upload and manage company logos (PNG, JPG, SVG, WebP)
- **Certificate A1**: Upload and manage digital certificates (.pfx, .p12)
- **Secure Password Storage**: Encrypted certificate password storage using AES-256-GCM
- **Private Storage**: All files stored in private Supabase Storage bucket
- **RLS Security**: Row-level security ensures users only access their company's data

## Setup Instructions

### 1. Generate Encryption Key

Generate a secure encryption key for certificate passwords:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add the generated key to your `.env.local`:

```bash
CERT_PASSWORD_ENCRYPTION_KEY=<generated_key_here>
```

### 2. Run Database Migration

Start Supabase (if using local development):

```bash
npx supabase start
```

Apply the migration:

```bash
npx supabase db push
```

Or if using remote Supabase, the migration will run automatically on next deployment.

### 3. Verify Storage Bucket

The migration creates a private bucket called `company-assets`. Verify it exists:

1. Go to Supabase Dashboard → Storage
2. Check for `company-assets` bucket (should be private)

## Usage

### Accessing the Feature

1. Navigate to `/app/settings/company`
2. Click on the "Certificados" tab
3. You'll see three sections:
   - **Logo da Empresa**: Upload company logo
   - **Certificado Digital A1**: Upload certificate file
   - **Senha do Certificado**: Save encrypted password

### Logo Upload

1. Click "Selecionar Logo"
2. Choose an image file (max 5MB)
3. Preview appears automatically
4. Click "Upload" to save
5. Logo is displayed with option to remove

### Certificate Upload

1. Click "Selecionar Certificado"
2. Choose a .pfx or .p12 file (max 10MB)
3. Click "Upload"
4. Upload timestamp is displayed
5. Option to remove certificate

### Password Management

1. Enter certificate password
2. Click "Salvar"
3. Password is encrypted and stored securely
4. Green confirmation shows password is saved
5. Password is never displayed again for security
6. Can update or remove password anytime

## Security Features

### Encryption

- Passwords encrypted using AES-256-GCM
- Unique salt and IV for each password
- PBKDF2 key derivation (100,000 iterations)
- Encryption key stored in environment variables

### Storage Security

- Private bucket (no public access)
- Files organized by company ID: `companies/{company_id}/...`
- RLS policies enforce company membership
- Certificates never exposed via public URLs

### API Security

- All endpoints require authentication
- Company membership verified before any operation
- Service role key used server-side only
- Never exposed to client

## File Structure

```
app/api/company/
├── logo/
│   ├── upload/route.ts      # Upload logo
│   ├── signed-url/route.ts  # Get signed URL for display
│   └── delete/route.ts      # Delete logo
└── cert-a1/
    ├── upload/route.ts      # Upload certificate
    ├── delete/route.ts      # Delete certificate
    └── password/route.ts    # Manage password (POST/DELETE)

components/settings/
└── CertificatesSection.tsx  # UI component

lib/
├── upload-helpers.ts        # File validation utilities
└── vault-helpers.ts         # Encryption/decryption functions

supabase/migrations/
└── 20251222010000_company_assets_management.sql
```

## Testing

### Manual Testing Checklist

- [ ] Upload a logo and verify it displays
- [ ] Delete logo and verify it's removed
- [ ] Upload a certificate (.pfx file)
- [ ] Delete certificate
- [ ] Save certificate password
- [ ] Update certificate password
- [ ] Delete certificate password
- [ ] Verify RLS: Try accessing another company's files (should fail)

### Automated Testing

```bash
# Run TypeScript checks
npm run type-check

# Run linter
npm run lint

# Build project
npm run build
```

## Troubleshooting

### "CERT_PASSWORD_ENCRYPTION_KEY not configured"

**Solution**: Generate and add encryption key to `.env.local` (see Setup step 1)

### "Bucket 'company-assets' not found"

**Solution**: Run the database migration to create the bucket

### "Permission denied" when uploading

**Solution**: Verify user is a member of the company in `company_members` table

### Logo not displaying

**Solution**: Check browser console for errors. Signed URLs expire after 1 hour.

## Future Enhancements

- [ ] Extract certificate expiration date from .pfx file
- [ ] Add certificate expiration warnings
- [ ] Implement Supabase Vault when available
- [ ] Add certificate validation before upload
- [ ] Support for multiple certificates (A1, A3, etc.)

## Support

For issues or questions, check:
- Migration file: `supabase/migrations/20251222010000_company_assets_management.sql`
- API routes: `app/api/company/`
- UI component: `components/settings/CertificatesSection.tsx`
