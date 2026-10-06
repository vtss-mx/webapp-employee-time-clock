import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { pick } from '../../test/companyPages';
import { page, production, renderAt } from '../../test/departments';
import { apiOk, mockFetch, type MockCall } from '../../test/http';
import type { Department } from '../../types';
import { DepartmentDetailPage } from './DepartmentDetailPage';
import { DepartmentsPage } from './DepartmentsPage';

const deleted: Department = { ...production, employee_count: 0, managers: [], deleted_at: '2026-10-05T16:00:00Z', deleted_by: 'ana@empresa.com' };
const RESTORED = 'Departamento restaurado.';

function server(current: () => Department = () => deleted) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/restore')) return apiOk(production, { code: 'DEPARTMENT_RESTORED', message: RESTORED });
    if (call.url.startsWith('/api/employees')) return apiOk(page([]));
    if (call.url.startsWith('/api/departments?')) return apiOk(page(call.url.includes('deleted=true') ? [deleted] : [production]));
    return apiOk(current());
  });
}

describe('Departamentos: «Eliminados»', () => {
  it('sin estados, el filtro es «Todos» / «Eliminados»; la fila eliminada se restaura con su confirmación', async () => {
    const { calls } = server();
    renderAt('/company/departments', '/company/departments', <DepartmentsPage />);
    await screen.findByText('Producción');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos', 'Eliminados']);
    await userEvent.click(screen.getByRole('option', { name: 'Eliminados' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/departments?page=1&size=10&deleted=true'));
    expect(await screen.findByText('1 eliminado')).toBeInTheDocument();
    const row = screen.getByText('Producción').closest('tr') as HTMLElement;
    expect(within(row).getByRole('cell', { name: /Se eliminó el .* por ana@empresa\.com/ })).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Producción' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el departamento Producción?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('DescripciónLínea de pan dulce');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
  });

  it('el detalle de uno eliminado: aviso con «Restaurar», sin acciones ni sus empleados; al restaurarlo vuelve el vigente', async () => {
    let current: Department = { ...deleted, description: null };
    const { calls } = server(() => current);
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Departamento eliminadoSe eliminó el/);
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar departamento' })).toBeNull();
    expect(calls.map((call) => call.url)).toEqual(['/api/departments/3']);

    current = production;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Producción' }));
    // Sin descripción, la confirmación no tiene detalles.
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el departamento Producción?' });
    expect(within(dialog).queryByRole('region', { name: 'Detalles' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('link', { name: 'Editar' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((call) => call.url.startsWith('/api/employees'))).toBe(true));
  });

  it('en inglés: «All» / «Deleted» y la confirmación', async () => {
    await setLocale('en-US');
    server();
    renderAt('/company/departments', '/company/departments', <DepartmentsPage />);
    await screen.findByText('Producción');
    await pick(/Filter by status/, /^Deleted$/);
    await userEvent.click(await screen.findByRole('button', { name: 'Restore Producción' }));
    expect(await screen.findByRole('dialog', { name: 'Restore the Producción department?' })).toBeInTheDocument();
  });
});
