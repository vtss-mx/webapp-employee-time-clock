import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { pick, renderPage, rowsOf, settle } from '../../test/companyPages';
import { documentsPage, platformContract, taxCertificate, trashed } from '../../test/documents';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import type { CompanyDocument } from '../../types/documents';
import { DocumentsPage } from './DocumentsPages';

const DELETED = 'Documento eliminado.';
const RESTORED = 'Documento restaurado.';
const fileReply = () => apiOk({ file_name: 'constancia-fiscal.pdf', content_type: 'application/pdf', size: 4, data: btoa('hola') }, { code: 'COMPANY_DOCUMENT_FILE' });

interface Replies {
  live?: CompanyDocument[];
  trash?: CompanyDocument[];
  file?: () => Response | Promise<Response>;
  list?: () => Response;
  remove?: () => Response;
}

/** La API de documentos de la empresa (`/api/documents`): lista, archivo, eliminar y restaurar. */
const deletedReply = () => apiOk(null, { code: 'COMPANY_DOCUMENT_DELETED', message: DELETED });

function server({ live = [taxCertificate, platformContract], trash = [trashed(taxCertificate), trashed(platformContract)], file = fileReply, list, remove = deletedReply }: Replies = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/file')) return file();
    if (call.url.endsWith('/restore')) return apiOk(taxCertificate, { code: 'COMPANY_DOCUMENT_RESTORED', message: RESTORED });
    if (call.init.method === 'DELETE') return remove();
    if (list) return list();
    return apiOk(documentsPage(call.url.includes('deleted=true') ? trash : live));
  });
}

const renderDocuments = () => renderPage('/company/documents', '/company/documents', <DocumentsPage />);
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const listCalls = (calls: MockCall[]) => calls.filter((call) => call.url.startsWith('/api/documents?'));

describe('Documentos de la empresa', () => {
  it('lista: documento, tipo del catálogo, tamaño en MB, quién y cuándo (con «Plataforma»), nota y acciones según el backend', async () => {
    const { calls } = server();
    renderDocuments();
    expect(await screen.findByText('constancia-fiscal.pdf')).toBeInTheDocument();
    expect(calls.map((call) => call.url)).toEqual(['/api/documents?page=1&size=10']);
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeInTheDocument();
    expect(screen.getByText('2 documentos · para la facturación de tu empresa')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Documento', 'Tipo', 'Tamaño', 'Subido', 'Nota', 'Acciones']);

    const own = rowOf('constancia-fiscal.pdf');
    expect(within(own).getByText('Constancia de situación fiscal')).toHaveClass('badge');
    expect(within(own).getByText('1.20 MB').closest('td')).toHaveAttribute('data-label', 'Tamaño');
    expect(within(own).getByText('ana@empresa.com').closest('td')).toHaveAttribute('data-label', 'Subido');
    expect(within(own).getByText('Vigente a octubre').closest('td')).toHaveClass('table__wide');
    expect(within(own).queryByText('Plataforma')).toBeNull();
    expect(within(own).getByRole('button', { name: 'Eliminar constancia-fiscal.pdf' })).toBeInTheDocument();

    // Lo subió la plataforma: la empresa lo descarga, pero no se le ofrece eliminarlo.
    const platform = rowOf('contrato-servicio.docx');
    expect(platform).toHaveTextContent('Contrato');
    expect(platform).toHaveTextContent('0.50 MB');
    expect(within(platform).getByText('Plataforma')).toHaveAttribute('title', 'Lo subió el administrador de la plataforma');
    expect(within(platform).getByText('—')).toBeInTheDocument(); // sin nota
    expect(within(platform).getByRole('button', { name: 'Descargar contrato-servicio.docx' })).toBeInTheDocument();
    expect(within(platform).queryByRole('button', { name: /Eliminar/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Subir documento' })).toHaveAttribute('href', '/company/documents/new');
  });

  it('eliminar pregunta con el documento y que va a «Eliminados»; cancelar no envía nada; al confirmar avisa y recarga', async () => {
    const { calls } = server();
    renderDocuments();
    await screen.findByText('constancia-fiscal.pdf');
    const remove = () => userEvent.click(within(rowOf('constancia-fiscal.pdf')).getByRole('button', { name: 'Eliminar constancia-fiscal.pdf' }));

    await remove();
    let dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar constancia-fiscal.pdf?' });
    expect(rowsOf(dialog, 'Detalles')).toEqual(['TipoConstancia de situación fiscal', 'Archivoconstancia-fiscal.pdf', 'Tamaño1.20 MB']);
    expect(dialog).toHaveTextContent('No se podrá descargar mientras esté en «Eliminados».');
    expect(dialog).toHaveTextContent('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);

    await remove();
    dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar constancia-fiscal.pdf?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('dialog', { name: DELETED })).toBeInTheDocument();
    expect(calls.filter((call) => call.init.method === 'DELETE').map((call) => call.url)).toEqual(['/api/documents/11']);
    await waitFor(() => expect(listCalls(calls)).toHaveLength(2));
  });

  it('«Eliminados»: pide solo esos; restaura lo que puede (con su confirmación) y no ofrece restaurar lo de la plataforma', async () => {
    const { calls } = server();
    renderDocuments();
    await screen.findByText('constancia-fiscal.pdf');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/documents?page=1&size=10&deleted=true'));
    expect(await screen.findByText('2 eliminados')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Documento', 'Tipo', 'Tamaño', 'Eliminación', 'Acciones']);
    const own = rowOf('constancia-fiscal.pdf');
    expect(within(own).getByRole('cell', { name: /Se eliminó el .* por ana@empresa\.com/ })).toBeInTheDocument();
    expect(within(own).queryByRole('button', { name: /Descargar/ })).toBeNull();
    expect(within(rowOf('contrato-servicio.docx')).queryByRole('button')).toBeNull();

    await userEvent.click(within(own).getByRole('button', { name: 'Restaurar constancia-fiscal.pdf' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar constancia-fiscal.pdf?' });
    expect(rowsOf(dialog, 'Detalles')).toEqual(['TipoConstancia de situación fiscal', 'Archivoconstancia-fiscal.pdf', 'Tamaño1.20 MB']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/documents/11/restore' && call.init.method === 'POST')).toBe(true);
  });

  it('vacíos: sin documentos invita a subir el primero; «Eliminados» vacío lo dice', async () => {
    server({ live: [], trash: [] });
    renderDocuments();
    expect(await screen.findByText('Sin documentos')).toBeInTheDocument();
    expect(screen.getByText('Sube la constancia fiscal u otro documento para empezar.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Subir documento' })).toHaveLength(2); // encabezado y vacío
    expect(screen.queryByRole('navigation', { name: /Paginación/ })).toBeNull();
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
  });

  it('descargar: pide el archivo (base64) y lo guarda con su nombre, sin preguntar ni avisar; el botón trabaja mientras', async () => {
    const createObjectURL = vi.fn((_: Blob) => 'blob:doc');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const saved: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this);
    });
    let release: (response: Response) => void = () => undefined;
    const { calls } = server({ file: () => new Promise<Response>((resolve) => (release = resolve)) });
    renderDocuments();
    await screen.findByText('constancia-fiscal.pdf');
    const button = within(rowOf('constancia-fiscal.pdf')).getByRole('button', { name: 'Descargar constancia-fiscal.pdf' });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    expect(within(rowOf('contrato-servicio.docx')).getByRole('button', { name: /Descargar/ })).toBeDisabled();
    await settle(() => release(fileReply()));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].download).toBe('constancia-fiscal.pdf');
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
    expect(calls.find((call) => call.url.endsWith('/file'))?.url).toBe('/api/documents/11/file');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('si el servidor no deja eliminarlo (lo subió la plataforma), popup con su motivo y la lista sigue igual', async () => {
    const { calls } = server({ remove: () => apiFail(403, 'DOCUMENT_UPLOADED_BY_PLATFORM', 'Este documento lo subió la plataforma.') });
    renderDocuments();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar constancia-fiscal.pdf' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar constancia-fiscal.pdf?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el documento' })).toHaveTextContent('Este documento lo subió la plataforma.');
    expect(listCalls(calls)).toHaveLength(1);
    expect(screen.getByText('constancia-fiscal.pdf')).toBeInTheDocument();
  });

  it('si el archivo no se puede descargar, popup con el motivo del servidor', async () => {
    server({ file: () => apiFail(404, 'DOCUMENT_NOT_FOUND', 'El documento no existe') });
    renderDocuments();
    await userEvent.click(within(await screen.findByRole('row', { name: /constancia-fiscal\.pdf/ })).getByRole('button', { name: /Descargar/ }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo descargar el documento' })).toHaveTextContent('El documento no existe');
  });

  it('si la lista no carga: popup y «Reintentar»', async () => {
    let fail = true;
    server({ list: () => (fail ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(documentsPage([taxCertificate]))) });
    renderDocuments();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los documentos' })).toHaveTextContent('Sin permiso');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('constancia-fiscal.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 documento · para la facturación de tu empresa')).toBeInTheDocument();
  });

  it('en inglés: encabezados, marca de la plataforma, confirmación y vacío', async () => {
    await setLocale('en-US');
    server();
    renderDocuments();
    await screen.findByText('constancia-fiscal.pdf');
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByText("2 documents · for your company's invoicing")).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Document', 'Type', 'Size', 'Uploaded', 'Note', 'Actions']);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete constancia-fiscal.pdf' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete constancia-fiscal.pdf?' });
    expect(rowsOf(dialog, 'Details')).toEqual(['TypeConstancia de situación fiscal', 'Fileconstancia-fiscal.pdf', 'Size1.20 MB']);
    expect(dialog).toHaveTextContent("It can't be downloaded while it's in Deleted.");
  });
});
