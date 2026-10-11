import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { pick, renderPage, rowsOf, settle } from '../../test/companyPages';
import { documentsPage, employeeDocument } from '../../test/documents';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import type { EmployeeDocument } from '../../types/employeeDocuments';
import { formatDateTime } from '../../utils/format';
import { EmployeeDocumentList, useMyDocumentList } from './EmployeeDocumentList';

/*
 * Tabla de «mis documentos» del empleado (hoy vive dentro del paso de documentos del registro de identidad): se
 * prueba el componente directamente con su propio listado (`useMyDocumentList`), sin pasar por la pantalla del paso.
 */

const DELETED = 'Documento eliminado.';
const RESTORED = 'Documento restaurado.';

/** El pasaporte en revisión (se puede eliminar) y el comprobante que la empresa ya revisó (no se puede). */
const passport = () => employeeDocument();
const proof = () =>
  employeeDocument({
    id: 8,
    type: 'PROOF_OF_ADDRESS',
    file_name: 'luz.pdf',
    content_type: 'application/pdf',
    ocr_processed: false,
    ocr_confidence: null,
    confirmed: true,
    confirmed_by: 'ana@empresa.com',
    confirmed_at: '2026-10-06T12:00:00Z',
    can_delete: false, // el SERVIDOR decide: uno confirmado ya no se puede eliminar (409 DOCUMENT_CONFIRMED)
  });

/** Ya en «Eliminados» (lo que responde el backend con `deleted=true`). Uno eliminado NUNCA está confirmado —la
 * empresa solo confirma documentos vigentes (`ensure_live`)— y siempre se puede restaurar, así que el servidor
 * lo manda con `can_delete` en true. */
const trashed = (document: EmployeeDocument): EmployeeDocument => ({
  ...document,
  confirmed: false,
  confirmed_by: null,
  confirmed_at: null,
  can_delete: true,
  deleted_at: '2026-10-06T15:00:00Z',
  deleted_by: 'ana@empresa.com',
});

const fileReply = () => apiOk({ file_name: 'pasaporte.jpg', content_type: 'image/jpeg', size: 4, data: btoa('foto') }, { code: 'EMPLOYEE_DOCUMENT_FILE' });
const deletedReply = () => apiOk(null, { code: 'EMPLOYEE_DOCUMENT_DELETED', message: DELETED });
const restoredReply = () => apiOk(passport(), { code: 'EMPLOYEE_DOCUMENT_RESTORED', message: RESTORED });

interface Replies {
  live?: EmployeeDocument[];
  trash?: EmployeeDocument[];
  file?: () => Response | Promise<Response>;
  restore?: () => Response | Promise<Response>;
  remove?: () => Response;
  /** Responde TODA la lista (p. ej. una falla de permisos y luego los documentos). */
  list?: () => Response;
}

/** La API de los documentos del empleado (`/api/me/documents`): lista, archivo, eliminar y restaurar. */
function server({ live = [passport(), proof()], trash = [trashed(passport())], file = fileReply, restore = restoredReply, remove = deletedReply, list }: Replies = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/file')) return file();
    if (call.url.endsWith('/restore')) return restore();
    if (call.init.method === 'DELETE') return remove();
    if (list) return list();
    return apiOk(documentsPage(call.url.includes('deleted=true') ? trash : live));
  });
}

/** El listado tal como lo usa el paso del registro: su hook y su tabla. */
function MyDocuments() {
  const list = useMyDocumentList();
  return <EmployeeDocumentList list={list} />;
}

const renderList = () => renderPage('/registro/documentos', '/registro/documentos', <MyDocuments />);
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const listCalls = (calls: MockCall[]) => calls.filter((call) => call.url.startsWith('/api/me/documents?'));
const stubDownload = () => {
  const createObjectURL = vi.fn((_: Blob) => 'blob:doc');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const saved: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this);
  });
  return { createObjectURL, saved };
};

describe('Mis documentos: la tabla del empleado', () => {
  it('lista cada documento con su tipo del catálogo, su estado, la lectura del OCR, cuándo se subió y sus acciones', async () => {
    const { calls } = server();
    renderList();
    expect(await screen.findByText('pasaporte.jpg')).toBeInTheDocument();
    expect(listCalls(calls).map((call) => call.url)).toEqual(['/api/me/documents?page=1&size=10']);
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Documento', 'Tipo', 'Estado', 'Subido', 'Acciones']);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('Mostrando 1–2 de 2 documentos');

    // En revisión: la empresa todavía no lo confirma, así que se puede descargar y eliminar.
    const mine = rowOf('pasaporte.jpg');
    expect(within(mine).getByText('Pasaporte')).toHaveClass('badge');
    expect(within(mine).getByText('En revisión')).toHaveClass('badge');
    expect(within(mine).getByText('Datos leídos')).toBeInTheDocument();
    expect(within(mine).getByText(formatDateTime(passport().uploaded_at)).closest('td')).toHaveAttribute('data-label', 'Subido');
    expect(within(mine).getByRole('button', { name: 'Descargar pasaporte.jpg' })).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Eliminar pasaporte.jpg' })).toBeInTheDocument();

    // Revisado por la empresa: se descarga, pero ya no se ofrece eliminarlo (lo decide el backend con `confirmed`).
    const reviewed = rowOf('luz.pdf');
    expect(within(reviewed).getByText('Comprobante de domicilio')).toHaveClass('badge');
    expect(within(reviewed).getByText('Revisado')).toHaveAttribute('title', 'Tu empresa ya revisó este documento');
    expect(within(reviewed).getByText('Sin lectura automática')).toBeInTheDocument();
    expect(within(reviewed).getByRole('button', { name: 'Descargar luz.pdf' })).toBeInTheDocument();
    expect(within(reviewed).queryByRole('button', { name: /Eliminar/ })).toBeNull();
  });

  it('descargar pide el archivo y lo guarda con su nombre, sin preguntar ni avisar; mientras tanto los demás botones esperan', async () => {
    const { createObjectURL, saved } = stubDownload();
    let release: (response: Response) => void = () => undefined;
    const { calls } = server({ file: () => new Promise<Response>((resolve) => (release = resolve)) });
    renderList();
    await screen.findByText('pasaporte.jpg');
    const button = within(rowOf('pasaporte.jpg')).getByRole('button', { name: 'Descargar pasaporte.jpg' });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    expect(within(rowOf('luz.pdf')).getByRole('button', { name: 'Descargar luz.pdf' })).toBeDisabled();
    expect(within(rowOf('pasaporte.jpg')).getByRole('button', { name: 'Eliminar pasaporte.jpg' })).toBeDisabled();

    await settle(() => release(fileReply()));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].download).toBe('pasaporte.jpg');
    expect(createObjectURL.mock.calls[0][0].type).toBe('image/jpeg');
    expect(calls.find((call) => call.url.endsWith('/file'))?.url).toBe('/api/me/documents/7/file');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('si el archivo no se puede descargar (sin almacenamiento), popup con el motivo del servidor', async () => {
    stubDownload();
    server({ file: () => apiFail(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento no está disponible.') });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar pasaporte.jpg' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo descargar el documento' })).toHaveTextContent('El almacenamiento no está disponible.');
  });

  it('eliminar pregunta con el documento y que pasa a «Eliminados»; cancelar no envía nada; al confirmar avisa y recarga', async () => {
    const { calls } = server();
    renderList();
    await screen.findByText('pasaporte.jpg');
    const remove = () => userEvent.click(within(rowOf('pasaporte.jpg')).getByRole('button', { name: 'Eliminar pasaporte.jpg' }));

    await remove();
    let dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar pasaporte.jpg?' });
    expect(rowsOf(dialog, 'Detalles')).toEqual(['TipoPasaporte', 'Archivopasaporte.jpg']);
    expect(dialog).toHaveTextContent('Podrás subir otro en su lugar.');
    expect(dialog).toHaveTextContent('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);

    await remove();
    dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar pasaporte.jpg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('dialog', { name: DELETED })).toBeInTheDocument();
    expect(calls.filter((call) => call.init.method === 'DELETE').map((call) => call.url)).toEqual(['/api/me/documents/7']);
    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));
  });

  it('si el servidor no deja eliminarlo (la empresa ya lo revisó), popup con su motivo y la lista sigue igual', async () => {
    const { calls } = server({ remove: () => apiFail(409, 'EMPLOYEE_DOCUMENT_CONFIRMED', 'Tu empresa ya revisó este documento.') });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar pasaporte.jpg' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar pasaporte.jpg?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el documento' })).toHaveTextContent('Tu empresa ya revisó este documento.');
    expect(listCalls(calls)).toHaveLength(1);
    expect(screen.getByText('pasaporte.jpg')).toBeInTheDocument();
  });

  it('«Eliminados»: pide solo esos, dice cuándo y quién lo eliminó y restaura tras confirmar (un botón a la vez)', async () => {
    let release: (response: Response) => void = () => undefined;
    const { calls } = server({ trash: [trashed(passport()), trashed(proof())], restore: () => new Promise<Response>((resolve) => (release = resolve)) });
    renderList();
    await screen.findByText('pasaporte.jpg');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/me/documents?page=1&size=10&deleted=true'));
    expect(await screen.findByText('luz.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Documento', 'Tipo', 'Estado', 'Eliminación', 'Acciones']);
    const mine = rowOf('pasaporte.jpg');
    expect(within(mine).getByRole('cell', { name: /Se eliminó el .* por ana@empresa\.com/ })).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: /Descargar/ })).toBeNull();
    expect(within(mine).queryByRole('button', { name: /^Eliminar/ })).toBeNull();

    await userEvent.click(within(mine).getByRole('button', { name: 'Restaurar pasaporte.jpg' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar pasaporte.jpg?' });
    expect(rowsOf(dialog, 'Detalles')).toEqual(['TipoPasaporte', 'Archivopasaporte.jpg']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    // Mientras uno se restaura, su botón trabaja y el del otro documento espera.
    const restoring = within(rowOf('pasaporte.jpg')).getByRole('button', { name: 'Restaurar pasaporte.jpg' });
    await waitFor(() => expect(restoring).toHaveAttribute('aria-busy', 'true'));
    expect(within(rowOf('luz.pdf')).getByRole('button', { name: 'Restaurar luz.pdf' })).toBeDisabled();

    await settle(() => release(restoredReply()));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/me/documents/7/restore' && call.init.method === 'POST')).toBe(true);
    await waitFor(() => expect(listCalls(calls)).toHaveLength(3)); // la lista se vuelve a pedir
  });

  it('si no se puede restaurar, popup con el motivo del servidor', async () => {
    server({ restore: () => apiFail(409, 'RESTORE_CONFLICT', 'Ya subiste otro documento de ese tipo.') });
    renderList();
    await screen.findByText('pasaporte.jpg');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar pasaporte.jpg' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar pasaporte.jpg?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo restaurar' })).toHaveTextContent('Ya subiste otro documento de ese tipo.');
  });

  it('vacíos: sin documentos invita a subir el primero y «Eliminados» vacío lo dice; sin registros no hay paginador', async () => {
    server({ live: [], trash: [] });
    renderList();
    expect(await screen.findByText('Sin documentos')).toBeInTheDocument();
    expect(screen.getByText('Sube tu primera identificación o comprobante para empezar.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Paginación/ })).toBeNull();
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
    expect(screen.getByText('Lo que elimines se guarda aquí durante un año.')).toBeInTheDocument();
  });

  it('si la lista no carga: popup y «Reintentar»', async () => {
    let fails = true;
    server({ list: () => (fails ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(documentsPage([passport()]))) });
    renderList();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus documentos' })).toHaveTextContent('Sin permiso');
    fails = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('pasaporte.jpg')).toBeInTheDocument();
  });
});
