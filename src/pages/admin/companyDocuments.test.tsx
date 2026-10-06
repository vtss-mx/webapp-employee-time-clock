import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { billingReply } from '../../test/billing';
import { company, pick, renderPage, rowsOf } from '../../test/companyPages';
import { documentsPage, platformContract, taxCertificate } from '../../test/documents';
import { chooseFiles } from '../../test/files';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import type { CompanyDocument } from '../../types/documents';
import { CompanyDetailPage } from './CompanyDetailPage';
import { CompanyDocumentUploadPage } from './CompanyDocumentUploadPage';

/** Lo que ve el ADMIN: puede eliminar y restaurar también lo que subió la plataforma (lo dice el backend). */
const adminView = (document: CompanyDocument): CompanyDocument => ({ ...document, can_delete: true });
const documentsUrl = '/api/admin/companies/4/documents';

function renderDetail(documents: () => Response = () => apiOk(documentsPage([adminView(taxCertificate), adminView(platformContract)]))) {
  const { calls } = mockFetch((call: MockCall) => {
    if (call.url.startsWith(documentsUrl)) return call.init.method === 'DELETE' ? apiOk(null, { message: 'Documento eliminado.' }) : documents();
    const billing = billingReply(call);
    if (billing) return billing;
    if (call.url.includes('/admins')) return apiOk({ items: [], total: 0, page: 1, size: 10 });
    return apiOk(company);
  });
  renderPage('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
  return calls;
}

const section = () => screen.getByRole('heading', { name: 'Documentos' }).closest('section') as HTMLElement;

describe('Ficha de la empresa (ADMIN): documentos', () => {
  it('la sección lista los documentos de esa empresa, con «Subir documento» y eliminar también lo de la plataforma', async () => {
    const calls = renderDetail();
    expect(await screen.findByText('contrato-servicio.docx')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.startsWith(documentsUrl)).map((call) => call.url)).toEqual([`${documentsUrl}?page=1&size=10`]);
    expect(within(section()).getByRole('link', { name: 'Subir documento' })).toHaveAttribute('href', '/admin/companies/4/documents/new');
    const row = screen.getByText('contrato-servicio.docx').closest('tr') as HTMLElement;
    expect(within(row).getByText('Plataforma')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Eliminar contrato-servicio.docx' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar contrato-servicio.docx?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('dialog', { name: 'Documento eliminado.' })).toBeInTheDocument();
    expect(calls.some((call) => call.url === `${documentsUrl}/12` && call.init.method === 'DELETE')).toBe(true);
  });

  it('sin documentos: vacío compacto con la acción para subir el primero; «Eliminados» se pide a la ruta del ADMIN', async () => {
    const calls = renderDetail(() => apiOk(documentsPage([])));
    await screen.findByRole('heading', { name: 'Documentos' });
    expect(await within(section()).findByText('Sin documentos')).toBeInTheDocument();
    expect(within(section()).getByRole('status')).toHaveClass('empty-state--compact');
    expect(within(section()).getAllByRole('link', { name: 'Subir documento' })).toHaveLength(2);
    await userEvent.click(within(section()).getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /^Eliminados$/ }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe(`${documentsUrl}?page=1&size=10&deleted=true`));
    expect(await within(section()).findByText('Nada eliminado')).toBeInTheDocument();
  });
});

describe('Subir un documento de una empresa (ADMIN)', () => {
  function renderUpload(companyReply: () => Response = () => apiOk(company)) {
    const { calls } = mockFetch((call: MockCall) =>
      call.init.method === 'POST' ? apiOk(taxCertificate, { status: 201, code: 'COMPANY_DOCUMENT_UPLOADED', message: 'Documento subido.' }) : companyReply(),
    );
    renderPage('/admin/companies/:id/documents/new', '/admin/companies/4/documents/new', <CompanyDocumentUploadPage />, { targets: { '/admin/companies/:id': 'Ficha de la empresa' } });
    return calls;
  }

  it('la empresa va en el subtítulo y en la confirmación; sube a su ruta y regresa a su ficha', async () => {
    const calls = renderUpload();
    expect(await screen.findByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(screen.getAllByText('Panificadora')).toHaveLength(2); // el regreso a su ficha y el subtítulo
    expect(screen.getByRole('link', { name: /Panificadora/ })).toHaveAttribute('href', '/admin/companies/4');
    chooseFiles(screen.getByLabelText('Documento'), new File(['%PDF'], 'constancia.pdf', { type: 'application/pdf' }));
    await pick(/Tipo de documento/, /Constancia de situación fiscal/);
    await userEvent.click(screen.getByRole('button', { name: 'Subir documento' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Subir constancia.pdf?' });
    expect(rowsOf(dialog, 'Se subirá')).toEqual(['EmpresaPanificadora', 'TipoConstancia de situación fiscal', 'Archivoconstancia.pdf', 'Tamaño< 0.01 MB']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Subir documento' }));
    expect(await screen.findByText('Ficha de la empresa')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Documento subido.' })).toBeInTheDocument();
    expect(calls.filter((call) => call.init.method === 'POST').map((call) => call.url)).toEqual([documentsUrl]);
  });

  it('si la empresa no carga: popup y «Volver a cargar»', async () => {
    let fail = true;
    renderUpload(() => (fail ? apiFail(404, 'COMPANY_NOT_FOUND', 'La empresa no existe') : apiOk(company)));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' })).toHaveTextContent('La empresa no existe');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByLabelText('Documento')).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    renderUpload();
    expect(await screen.findByRole('heading', { name: 'Upload document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Document type/ })).toHaveTextContent('Choose the type');
  });
});
