import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const resolveCompanyContextMock = vi.fn();
const importLegacyNfeXmlFilesMock = vi.fn();
const createLegacyImportDependenciesMock = vi.fn();

vi.mock('@/lib/auth/resolve-company', () => ({
  resolveCompanyContext: resolveCompanyContextMock,
}));

vi.mock('@/lib/fiscal/nfe/legacy-import/importer', () => ({
  importLegacyNfeXmlFiles: importLegacyNfeXmlFilesMock,
  createLegacyImportDependencies: createLegacyImportDependenciesMock,
}));

describe('POST /api/fiscal/nfe/legacy-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processa upload e retorna resumo da importação', async () => {
    resolveCompanyContextMock.mockResolvedValue({
      companyId: '7310b348-5a11-4f14-bc5a-8c5a33bc6393',
      userId: '15cd1234-8d7e-46f5-9f34-9fd17b638c10',
    });
    createLegacyImportDependenciesMock.mockReturnValue({ mocked: true });
    importLegacyNfeXmlFilesMock.mockResolvedValue({
      imported: 1,
      duplicated: 0,
      errors: 0,
      results: [],
    });

    const { POST } = await import('@/app/api/fiscal/nfe/legacy-import/route');

    const formData = new FormData();
    formData.append('files', new File(['<xml/>'], 'nota.xml', { type: 'application/xml' }));

    const request = new NextRequest('http://localhost/api/fiscal/nfe/legacy-import', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.imported).toBe(1);
    expect(importLegacyNfeXmlFilesMock).toHaveBeenCalledTimes(1);
  });
});

