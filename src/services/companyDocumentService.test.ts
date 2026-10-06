import { describe, expect, it } from 'vitest';
import { documentsPage, taxCertificate, trashed } from '../test/documents';
import { apiOk, mockFetch } from '../test/http';
import type { ApiError } from './apiClient';
import { companyDocumentService, documentsBase } from './companyDocumentService';

const pdf = () => new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' });

describe('companyDocumentService: las mismas operaciones sobre la ruta del ADMIN o de la empresa', () => {
  it('lista los vigentes o «Eliminados» de la empresa de la sesión', async () => {
    const { calls } = mockFetch(apiOk(documentsPage([taxCertificate])));
    const service = companyDocumentService(documentsBase.company);
    expect(service.base).toBe('/documents');
    expect((await service.list({ page: 1, size: 10 })).items).toEqual([taxCertificate]);
    await service.list({ page: 2, size: 20, deleted: true });
    expect(calls.map((call) => call.url)).toEqual(['/api/documents?page=1&size=10', '/api/documents?page=2&size=20&deleted=true']);
  });

  it('sube en multipart (archivo, tipo y la nota solo si se escribió) y entrega el mensaje del servidor', async () => {
    const { calls } = mockFetch(apiOk(taxCertificate, { status: 201, code: 'COMPANY_DOCUMENT_UPLOADED', message: 'Documento subido.' }));
    const service = companyDocumentService(documentsBase.admin(4));
    expect(await service.upload({ file: pdf(), type: 'INCORPORATION', note: '  Firmada  ' })).toEqual({ document: taxCertificate, message: 'Documento subido.' });
    await service.upload({ file: pdf(), type: 'OTHER', note: '   ' });
    expect(calls.map((call) => [call.url, call.init.method])).toEqual([
      ['/api/admin/companies/4/documents', 'POST'],
      ['/api/admin/companies/4/documents', 'POST'],
    ]);
    const [first, second] = calls.map((call) => call.init.body as FormData);
    expect([(first.get('file') as File).name, first.get('type'), first.get('note')]).toEqual(['acta.pdf', 'INCORPORATION', 'Firmada']);
    expect(second.has('note')).toBe(false);
  });

  it('descarga el archivo (base64 en el contrato), elimina con el mensaje del servidor y restaura', async () => {
    const file = { file_name: 'acta.pdf', content_type: 'application/pdf', size: 4, data: btoa('%PDF') };
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/file')) return apiOk(file);
      if (call.url.endsWith('/restore')) return apiOk(taxCertificate, { message: 'Documento restaurado.' });
      return apiOk(null, { message: 'Documento eliminado.' });
    });
    const service = companyDocumentService(documentsBase.company);
    expect(await service.file(11)).toEqual(file);
    expect(await service.remove(11)).toBe('Documento eliminado.');
    expect(await service.restore(11)).toEqual({ item: taxCertificate, message: 'Documento restaurado.' });
    expect(calls.map((call) => [call.url, call.init.method])).toEqual([
      ['/api/documents/11/file', 'GET'],
      ['/api/documents/11', 'DELETE'],
      ['/api/documents/11/restore', 'POST'],
    ]);
  });

  it('una respuesta con otra forma se rechaza (no se dibuja un documento a medias)', async () => {
    mockFetch(apiOk({ id: 1 }));
    const error = await companyDocumentService(documentsBase.company)
      .restore(1)
      .catch((cause: unknown) => cause);
    expect((error as ApiError).code).toBe('INVALID_RESPONSE');
    mockFetch(apiOk(documentsPage([trashed(taxCertificate)])));
    expect((await companyDocumentService(documentsBase.company).list({ page: 1, size: 10, deleted: true })).items[0].deleted_by).toBe('ana@empresa.com');
  });
});
