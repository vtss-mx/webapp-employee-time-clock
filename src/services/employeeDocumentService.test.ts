import { describe, expect, it } from 'vitest';
import { documentsPage, employeeDocument } from '../test/documents';
import { apiFail, apiOk, mockFetch } from '../test/http';
import type { ApiError } from './apiClient';
import { employeeDocumentsBase, myDocumentService } from './employeeDocumentService';

/*
 * Los documentos del PROPIO empleado (`/me/documents`): la empresa sale de la sesión, así que ninguna llamada lleva
 * un id de empleado. El expediente que revisa la empresa tiene su propia prueba (la pantalla de revisión).
 */

const photo = () => new File(['foto'], 'ine.jpg', { type: 'image/jpeg' });
const fileReply = { file_name: 'ine.jpg', content_type: 'image/jpeg', size: 4, data: btoa('foto') };

describe('myDocumentService: lo que el empleado hace con sus documentos', () => {
  it('lista los vigentes y los de «Eliminados» con su paginación', async () => {
    const doc = employeeDocument();
    const { calls } = mockFetch(apiOk(documentsPage([doc])));
    expect([myDocumentService.base, employeeDocumentsBase.mine]).toEqual(['/me/documents', '/me/documents']);
    expect((await myDocumentService.list({ page: 1, size: 10 })).items).toEqual([doc]);
    await myDocumentService.list({ page: 2, size: 20, deleted: true });
    expect(calls.map((call) => call.url)).toEqual(['/api/me/documents?page=1&size=10', '/api/me/documents?page=2&size=20&deleted=true']);
  });

  it('sube en multipart (el archivo con su nombre y el tipo del catálogo) y entrega el documento y el mensaje del servidor', async () => {
    const doc = employeeDocument();
    const { calls } = mockFetch(apiOk(doc, { status: 201, code: 'EMPLOYEE_DOCUMENT_UPLOADED', message: 'Documento subido.' }));
    expect(await myDocumentService.upload({ file: photo(), type: 'NATIONAL_ID' })).toEqual({ document: doc, message: 'Documento subido.' });
    const form = calls[0].init.body as FormData;
    expect([calls[0].url, calls[0].init.method]).toEqual(['/api/me/documents', 'POST']);
    expect([(form.get('file') as File).name, form.get('type')]).toEqual(['ine.jpg', 'NATIONAL_ID']);
  });

  it('descarga el archivo (base64 en el contrato), elimina con el mensaje del servidor y restaura el documento', async () => {
    const doc = employeeDocument();
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/file')) return apiOk(fileReply, { code: 'EMPLOYEE_DOCUMENT_FILE' });
      if (call.url.endsWith('/restore')) return apiOk(doc, { message: 'Documento restaurado.' });
      return apiOk(null, { code: 'EMPLOYEE_DOCUMENT_DELETED', message: 'Documento eliminado.' });
    });
    expect(await myDocumentService.file(7)).toEqual(fileReply);
    expect(await myDocumentService.remove(7)).toBe('Documento eliminado.');
    expect(await myDocumentService.restore(7)).toEqual({ item: doc, message: 'Documento restaurado.' });
    expect(calls.map((call) => [call.url, call.init.method])).toEqual([
      ['/api/me/documents/7/file', 'GET'],
      ['/api/me/documents/7', 'DELETE'],
      ['/api/me/documents/7/restore', 'POST'],
    ]);
  });

  it('una respuesta con otra forma se rechaza: nada se dibuja a medias', async () => {
    mockFetch(apiOk({ id: 7 }));
    const failed = async (task: () => Promise<unknown>) => ((await task().catch((cause: unknown) => cause)) as ApiError).code;
    expect(await failed(() => myDocumentService.upload({ file: photo(), type: 'PASSPORT' }))).toBe('INVALID_RESPONSE');
    mockFetch(apiOk({ file_name: 'ine.jpg' }));
    expect(await failed(() => myDocumentService.file(7))).toBe('INVALID_RESPONSE');
    mockFetch(apiOk({ items: [{ id: 7 }], total: 1, page: 1, size: 10 }));
    expect(await failed(() => myDocumentService.list({ page: 1, size: 10 }))).toBe('INVALID_RESPONSE');
    mockFetch(apiOk({ id: 7 }));
    expect(await failed(() => myDocumentService.restore(7))).toBe('INVALID_RESPONSE');
  });

  it('un rechazo del servidor (la empresa ya lo confirmó) llega con su código y su motivo', async () => {
    mockFetch(apiFail(409, 'EMPLOYEE_DOCUMENT_CONFIRMED', 'Tu empresa ya revisó este documento.'));
    const error = (await myDocumentService.remove(7).catch((cause: unknown) => cause)) as ApiError;
    expect([error.code, error.status, error.message]).toEqual(['EMPLOYEE_DOCUMENT_CONFIRMED', 409, 'Tu empresa ya revisó este documento.']);
  });
});
