import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { pick, renderPage, rowsOf } from '../../test/companyPages';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import type { EmployeeDocument, EmployeeDocumentRequirements } from '../../types/employeeDocuments';
import { EmployeeDocumentsPage } from './EmployeeDocumentsPages';

const DELETED = 'Documento eliminado.';
const RESTORED = 'Documento restaurado.';

const doc = (over: Partial<EmployeeDocument> = {}): EmployeeDocument => ({
  id: 11,
  employee_id: 7,
  type: 'NATIONAL_ID',
  file_name: 'ine.jpg',
  content_type: 'image/jpeg',
  size: 480000,
  uploaded_by: 'juan@empresa.com',
  uploaded_by_employee: true,
  uploaded_at: '2026-10-05T10:00:00Z',
  ocr_processed: true,
  ocr_confidence: 0.91,
  mrz_verified: false,
  confirmed: false,
  confirmed_by: null,
  confirmed_at: null,
  deleted_at: null,
  deleted_by: null,
  data: { full_name: 'Juan Pérez', document_number: 'PEXJ900510HSRRNN09', birth_date: '1990-05-10', expiry_date: null, nationality: 'MEX', sex: 'M', curp: 'PEXJ900510HSRRNN09', voter_key: null, postal_code: '83000', address: null },
  ...over,
});
const trashedDoc = doc({ deleted_at: '2026-10-06T10:00:00Z', deleted_by: 'juan@empresa.com' });
const page = (items: EmployeeDocument[]) => ({ items, total: items.length, page: 1, size: 10 });
const requirements = (over: Partial<EmployeeDocumentRequirements> = {}): EmployeeDocumentRequirements => ({
  required: true,
  types: [
    { code: 'PASSPORT', category: 'OFFICIAL_ID' },
    { code: 'NATIONAL_ID', category: 'OFFICIAL_ID' },
    { code: 'PROOF_OF_ADDRESS', category: 'PROOF_OF_ADDRESS' },
  ],
  documents: [],
  needs_official_id: false,
  needs_proof_of_address: true,
  ...over,
});

const fileReply = () => apiOk({ file_name: 'ine.jpg', content_type: 'image/jpeg', size: 4, data: btoa('hola') }, { code: 'EMPLOYEE_DOCUMENT_FILE' });
const deletedReply = () => apiOk(null, { code: 'EMPLOYEE_DOCUMENT_DELETED', message: DELETED });

interface Replies {
  live?: EmployeeDocument[];
  trash?: EmployeeDocument[];
  reqs?: EmployeeDocumentRequirements | (() => Response);
  file?: () => Response | Promise<Response>;
  list?: () => Response;
  remove?: () => Response;
}

function server({ live = [doc()], trash = [trashedDoc], reqs = requirements(), file = fileReply, list, remove = deletedReply }: Replies = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/me/documents/requirements')) return typeof reqs === 'function' ? reqs() : apiOk(reqs, { code: 'EMPLOYEE_DOCUMENT_REQUIREMENTS' });
    if (call.url.endsWith('/file')) return file();
    if (call.url.endsWith('/restore')) return apiOk(doc(), { code: 'EMPLOYEE_DOCUMENT_RESTORED', message: RESTORED });
    if (call.init.method === 'DELETE') return remove();
    if (list) return list();
    return apiOk(page(call.url.includes('deleted=true') ? trash : live));
  });
}

const renderDocuments = () => renderPage('/employee/documents', '/employee/documents', <EmployeeDocumentsPage />);
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const listCalls = (calls: MockCall[]) => calls.filter((call) => call.url.startsWith('/api/me/documents?'));

describe('Documentos del empleado (onboarding)', () => {
  it('encabezado con lo que falta, lista con estado y acción para subir', async () => {
    const { calls } = server();
    renderDocuments();
    expect(await screen.findByText('ine.jpg')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mis documentos' })).toBeInTheDocument();
    // Requisitos: una identificación oficial ya está, el comprobante falta.
    expect(screen.getByText('Documentos que pide tu empresa')).toBeInTheDocument();
    expect(within(rowOf2('Una identificación oficial')).getByText('Listo')).toBeInTheDocument();
    expect(within(rowOf2('Comprobante de domicilio')).getByText('Pendiente')).toBeInTheDocument();
    // Lista.
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Documento', 'Tipo', 'Estado', 'Subido', 'Acciones']);
    expect(within(rowOf('ine.jpg')).getByText('En revisión')).toBeInTheDocument();
    expect(within(rowOf('ine.jpg')).getByText('Datos leídos')).toBeInTheDocument();
    expect(within(rowOf('ine.jpg')).getByRole('button', { name: 'Eliminar ine.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subir documento' })).toHaveAttribute('href', '/employee/documents/new');
    expect(calls.some((call) => call.url === '/api/me/documents/requirements')).toBe(true);
  });

  it('un documento ya confirmado por la empresa no se puede eliminar', async () => {
    server({ live: [doc({ confirmed: true, confirmed_by: 'admin@empresa.com' })] });
    renderDocuments();
    await screen.findByText('ine.jpg');
    const row = rowOf('ine.jpg');
    expect(within(row).getByText('Revisado')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Eliminar/ })).toBeNull();
  });

  it('eliminar pregunta, al confirmar avisa y recarga', async () => {
    const { calls } = server();
    renderDocuments();
    await screen.findByText('ine.jpg');
    await userEvent.click(within(rowOf('ine.jpg')).getByRole('button', { name: 'Eliminar ine.jpg' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar ine.jpg?' });
    expect(rowsOf(dialog, 'Detalles')).toEqual(['TipoCredencial para votar (INE)', 'Archivoine.jpg']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('dialog', { name: DELETED })).toBeInTheDocument();
    expect(calls.filter((call) => call.init.method === 'DELETE').map((call) => call.url)).toEqual(['/api/me/documents/11']);
    await waitFor(() => expect(listCalls(calls).length).toBeGreaterThanOrEqual(2));
  });

  it('«Eliminados»: pide solo esos y restaura con su confirmación', async () => {
    const { calls } = server();
    renderDocuments();
    await screen.findByText('ine.jpg');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/me/documents?page=1&size=10&deleted=true'));
    await userEvent.click(within(rowOf('ine.jpg')).getByRole('button', { name: 'Restaurar ine.jpg' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar ine.jpg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/me/documents/11/restore' && call.init.method === 'POST')).toBe(true);
  });

  it('descargar guarda el archivo sin preguntar ni avisar', async () => {
    const createObjectURL = vi.fn((_: Blob) => 'blob:doc');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const saved: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this);
    });
    server();
    renderDocuments();
    await screen.findByText('ine.jpg');
    await userEvent.click(within(rowOf('ine.jpg')).getByRole('button', { name: 'Descargar ine.jpg' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].download).toBe('ine.jpg');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si la descarga falla: popup con su título', async () => {
    const createObjectURL = vi.fn((_: Blob) => 'blob:doc');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    server({ file: () => apiFail(503, 'STORAGE_UNAVAILABLE', 'Sin almacenamiento') });
    renderDocuments();
    await screen.findByText('ine.jpg');
    await userEvent.click(within(rowOf('ine.jpg')).getByRole('button', { name: 'Descargar ine.jpg' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo descargar el documento' })).toHaveTextContent('Sin almacenamiento');
  });

  it('si eliminar falla: popup con su título', async () => {
    server({ remove: () => apiFail(409, 'CONFLICT', 'No se pudo eliminar') });
    renderDocuments();
    await screen.findByText('ine.jpg');
    await userEvent.click(within(rowOf('ine.jpg')).getByRole('button', { name: 'Eliminar ine.jpg' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar ine.jpg?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el documento' })).toHaveTextContent('No se pudo eliminar');
  });

  it('si los requisitos no cargan: la lista sigue y el popup lo reporta', async () => {
    server({ reqs: () => apiFail(500, 'INTERNAL', 'Falló el servidor') });
    renderDocuments();
    expect(await screen.findByText('ine.jpg')).toBeInTheDocument();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus documentos' })).toHaveTextContent('Falló el servidor');
  });

  it('sin documentos: estado vacío con acción; la empresa no exige: lo dice', async () => {
    server({ live: [], reqs: requirements({ required: false, needs_official_id: false, needs_proof_of_address: false }) });
    renderDocuments();
    expect(await screen.findByText('Sin documentos')).toBeInTheDocument();
    expect(screen.getByText('Tu empresa no pide documentos por ahora.')).toBeInTheDocument();
  });

  it('si la lista no carga: popup y «Reintentar»', async () => {
    let fail = true;
    server({ list: () => (fail ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(page([doc()]))) });
    renderDocuments();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus documentos' })).toHaveTextContent('Sin permiso');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('ine.jpg')).toBeInTheDocument();
  });

  it('un documento sin lectura automática lo indica en su estado', async () => {
    server({ live: [doc({ ocr_processed: false })] });
    renderDocuments();
    await screen.findByText('ine.jpg');
    expect(within(rowOf('ine.jpg')).getByText('Sin lectura automática')).toBeInTheDocument();
  });

  it('cuando ya subió todo lo que pide la empresa, el encabezado lo confirma', async () => {
    server({ reqs: requirements({ needs_official_id: false, needs_proof_of_address: false }) });
    renderDocuments();
    await screen.findByText('ine.jpg');
    expect(within(rowOf2('Una identificación oficial')).getByText('Listo')).toBeInTheDocument();
    expect(within(rowOf2('Comprobante de domicilio')).getByText('Listo')).toBeInTheDocument();
    expect(screen.getByText('Ya subiste lo que tu empresa pide.')).toBeInTheDocument();
  });

  it('en inglés: encabezado, columnas y estado', async () => {
    await setLocale('en-US');
    server();
    renderDocuments();
    await screen.findByText('ine.jpg');
    expect(screen.getByRole('heading', { name: 'My documents' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Document', 'Type', 'Status', 'Uploaded', 'Actions']);
    expect(within(rowOf('ine.jpg')).getByText('Under review')).toBeInTheDocument();
  });
});

/** Fila de la lista de requisitos (no es una tabla): el <li> que contiene el texto. */
function rowOf2(label: string): HTMLElement {
  return screen.getByText(label).closest('li') as HTMLElement;
}
