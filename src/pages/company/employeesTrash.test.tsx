import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { pick, renderPage } from '../../test/companyPages';
import { apiOk, mockFetch, type MockCall } from '../../test/http';
import { sampleUser } from '../../test/render';
import { withScreens } from '../../test/screens';
import type { Employee } from '../../types';
import { EmployeeShiftsPage } from './shifts/EmployeeShiftsPage';
import { EmployeeDetailPage } from './EmployeeDetailPage';
import { EmployeesListPage } from './EmployeesListPage';

const companyUser = withScreens({ ...sampleUser, role: 'COMPANY', employee: null });
const luis: Employee = {
  id: 8,
  user_id: 80,
  employee_number: 'EMP-8',
  first_name: 'Luis',
  last_name: 'Paz',
  full_name: 'Luis Paz',
  birth_date: '1990-05-10',
  rfc: null,
  curp: null,
  nss: null,
  phone: null,
  email: 'luis@empresa.com',
  active: true,
  headwear_exempt: false,
  face_status: 'NOT_ENROLLED',
  face_rejection_reason: null,
  latest_enrollment_id: null,
  has_face: false,
  face_samples: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  deleted_at: '2026-10-05T16:00:00Z',
  deleted_by: 'ana@empresa.com',
};
const live: Employee = { ...luis, deleted_at: null, deleted_by: null };
const page = (items: Employee[]) => ({ items, total: items.length, page: 1, size: 10 });
const RESTORED = 'Empleado restaurado. Debe registrar su rostro de nuevo.';

/** El servidor: «Eliminados» con Luis (o vacío), su restauración y lo que pide el expediente vigente. */
function server({ trash = [luis], current = () => luis }: { trash?: Employee[]; current?: () => Employee } = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/restore')) return apiOk(live, { code: 'EMPLOYEE_RESTORED', message: RESTORED });
    if (call.url.includes('/qr')) return apiOk({ live: false, live_until: null, last_issued_at: null, last_used_at: null });
    if (call.url.includes('/verifications') || call.url.includes('/devices') || call.url.includes('/shift-assignments')) return apiOk(page([]));
    if (call.url.startsWith('/api/employees?')) return apiOk(page(call.url.includes('deleted=true') ? trash : [live]));
    return apiOk(current());
  });
}

const renderList = () => renderPage('/company/employees', '/company/employees', <EmployeesListPage />, { targets: { '/company/employees/:id': 'Expediente' } });

describe('Empleados: «Eliminados»', () => {
  it('el filtro pide solo los eliminados; la fila dice cuándo y quién, no se abre y ofrece «Restaurar»', async () => {
    const { calls } = server();
    renderList();
    await screen.findByText('Luis Paz');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/employees?page=1&size=10&deleted=true'));
    expect(await screen.findByText('1 eliminado')).toBeInTheDocument();
    const row = screen.getByText('Luis Paz').closest('tr') as HTMLElement;
    expect(within(row).getByRole('cell', { name: /Se eliminó el .* por ana@empresa\.com/ })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Empleado', 'Correo', 'Eliminación', 'Acciones']);
    expect(row.closest('table')).toHaveClass('table--readonly');
    expect(screen.queryByRole('link', { name: 'Reverificar a todos' })).toBeNull();

    // Restaurar pregunta antes: quién regresa y que deberá registrar su rostro de nuevo.
    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Luis Paz' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Luis Paz?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Número de empleadoEMP-8Correoluis@empresa.com');
    expect(dialog.querySelector('.confirm-note')).toHaveTextContent('Deberá registrar su rostro de nuevo.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);

    const before = calls.length;
    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Luis Paz' }));
    dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Luis Paz?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(calls[before]).toMatchObject({ url: '/api/employees/8/restore', init: { method: 'POST' } });
    // La lista se vuelve a pedir (el registro sale de «Eliminados»).
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/employees?page=1&size=10&deleted=true'));
  });

  it('sin eliminados: «Nada eliminado»; con una búsqueda sin coincidencias: «Sin resultados»', async () => {
    server({ trash: [] });
    renderList();
    await screen.findByText('Luis Paz');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
    expect(screen.getByText('Lo que elimines se guarda aquí durante un año.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar empleados'), 'zz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('el expediente de un eliminado: aviso con «Restaurar», sin acciones ni secciones; al restaurarlo vuelve el vigente', async () => {
    let current = luis;
    const { calls } = server({ current: () => current });
    renderPage('/company/employees/:id', '/company/employees/8', <EmployeeDetailPage />, { user: companyUser });
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Empleado eliminadoSe eliminó el .* por ana@empresa\.com/);
    expect(screen.getByText('luis@empresa.com')).toBeInTheDocument();
    for (const action of ['Editar', 'Desactivar', 'Eliminar empleado', 'Turnos']) expect(screen.queryByRole('button', { name: action }) ?? screen.queryByRole('link', { name: action })).toBeNull();
    // No pide su QR, su bitácora ni sus dispositivos (el backend responde 404).
    expect(calls.map((call) => call.url)).toEqual(['/api/employees/8']);

    current = live;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Luis Paz' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar a Luis Paz?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Editar' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((call) => call.url.includes('/qr'))).toBe(true));
  });

  it('un eliminado sin número (opcional): su expediente dice «Sin capturar» y restaurarlo no lo menciona', async () => {
    const unnumbered = { ...luis, employee_number: null };
    server({ current: () => unnumbered });
    renderPage('/company/employees/:id', '/company/employees/8', <EmployeeDetailPage />, { user: companyUser });
    const banner = await screen.findByRole('status');
    expect(document.querySelector('.badge--info.badge--plain')).toBeNull();
    const row = screen.getByText('Número de empleado').closest('div') as HTMLElement;
    expect(row).toHaveTextContent('Número de empleadoSin capturar');
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Luis Paz' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Luis Paz?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent(/^Correoluis@empresa\.com$/);
  });

  it('los turnos de un eliminado: el aviso y su expediente, sin pedir sus turnos', async () => {
    const { calls } = server();
    renderPage('/company/employees/:id/shifts', '/company/employees/8/shifts', <EmployeeShiftsPage />, { targets: { '/company/employees/:id': 'Expediente del empleado' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Empleado eliminado');
    expect(screen.queryByRole('link', { name: 'Asignar turno' })).toBeNull();
    expect(calls.map((call) => call.url)).toEqual(['/api/employees/8']);
    await userEvent.click(within(screen.getByRole('status')).getByRole('link', { name: 'Expediente' }));
    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('en inglés: el filtro, la fila y la confirmación', async () => {
    await setLocale('en-US');
    server();
    renderList();
    await screen.findByText('Luis Paz');
    await pick(/Filter by status/, /^Deleted$/);
    expect(await screen.findByText('1 deleted')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Deleted .* by ana@empresa\.com/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore Luis Paz' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore Luis Paz?' });
    expect(dialog.querySelector('.confirm-note')).toHaveTextContent("They'll need to enroll their face again.");
    await act(() => setLocale('es-MX'));
    expect(screen.getByRole('dialog', { name: '¿Restaurar a Luis Paz?' })).toBeInTheDocument();
  });
});
