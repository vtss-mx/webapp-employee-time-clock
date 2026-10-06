import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { billingReply } from '../../test/billing';
import { company, pick, renderPage } from '../../test/companyPages';
import { apiOk, mockFetch, type MockCall } from '../../test/http';
import type { CompanyDetail } from '../../types';
import { CompaniesListPage } from './CompaniesListPage';
import { CompanyDetailPage } from './CompanyDetailPage';

const deleted: CompanyDetail = { ...company, employee_count: 0, deleted_at: '2026-10-05T16:00:00Z', deleted_by: 'admin@plataforma.com' };
const RESTORED = 'Empresa restaurada.';
const page = (items: CompanyDetail[]) => ({ items, total: items.length, page: 1, size: 10 });

/** La plataforma: «Eliminadas» con Panificadora, su restauración y lo que pide la ficha vigente. */
function server(current: () => CompanyDetail = () => deleted) {
  return mockFetch((call: MockCall) => {
    const billing = billingReply(call);
    if (billing) return billing;
    if (call.url.endsWith('/restore')) return apiOk(company, { code: 'COMPANY_RESTORED', message: RESTORED });
    if (call.url.includes('/admins')) return apiOk({ items: [], total: 0, page: 1, size: 10 });
    if (call.url.startsWith('/api/admin/companies?')) return apiOk(page(call.url.includes('deleted=true') ? [deleted] : [company]));
    return apiOk(current());
  });
}

describe('Empresas (ADMIN): «Eliminadas»', () => {
  it('el filtro «Eliminadas» pide solo esas; la fila dice cuándo y quién y se restaura con su confirmación', async () => {
    const { calls } = server();
    renderPage('/admin/companies', '/admin/companies', <CompaniesListPage />);
    await screen.findByText('Panificadora');
    await pick(/Filtrar por estado/, /^Eliminadas$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/admin/companies?page=1&size=10&deleted=true'));
    expect(await screen.findByText('1 eliminada')).toBeInTheDocument();
    const row = screen.getByText('Panificadora').closest('tr') as HTMLElement;
    expect(within(row).getByRole('cell', { name: /Se eliminó el .* por admin@plataforma\.com/ })).toBeInTheDocument();
    expect(within(row).queryByText('Activa')).toBeNull();

    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Panificadora' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar Panificadora?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Razón socialPanificadora del Norte SA de CVIdentificador fiscalRFC · PNO120315AB1 · MéxicoAdministradores1');
    expect(dialog.querySelector('.confirm-note')).toHaveTextContent('Sus fotos no se recuperan.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/admin/companies/4/restore' && call.init.method === 'POST')).toBe(true);
  });

  it('la ficha de una eliminada: aviso con «Restaurar», sin acciones, administradores, cobranza ni política', async () => {
    let current = deleted;
    const { calls } = server(() => current);
    renderPage('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Empresa eliminadaSe eliminó el .* por admin@plataforma\.com/);
    expect(screen.getByText('Panificadora del Norte SA de CV')).toBeInTheDocument();
    for (const name of ['Editar', 'Desactivar', 'Eliminar', 'Política de verificación', 'Agregar administrador']) {
      expect(screen.queryByRole('button', { name }) ?? screen.queryByRole('link', { name })).toBeNull();
    }
    expect(calls.map((call) => call.url)).toEqual(['/api/admin/companies/4']);

    current = company;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Panificadora' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar Panificadora?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Editar' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((call) => call.url.includes('/admins'))).toBe(true));
  });

  it('la ficha de una eliminada sin datos opcionales: «Sin identificador fiscal» y «Sin capturar»', async () => {
    server(() => ({ ...deleted, tax_country: null, tax_id_type: null, tax_id: null, legal_name: null, phone: null }));
    renderPage('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    expect(await screen.findByText(/Sin identificador fiscal · desde/)).toBeInTheDocument();
    expect(screen.getAllByText('Sin capturar')).toHaveLength(3);
  });

  it('en inglés: la opción del filtro y el subtítulo', async () => {
    await setLocale('en-US');
    server();
    renderPage('/admin/companies', '/admin/companies', <CompaniesListPage />);
    await screen.findByText('Panificadora');
    await pick(/Filter by status/, /^Deleted$/);
    expect(await screen.findByText('1 deleted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Panificadora' })).toBeInTheDocument();
  });
});
