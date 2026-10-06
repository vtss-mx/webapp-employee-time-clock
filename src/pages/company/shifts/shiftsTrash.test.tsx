import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ShiftRequestItem } from '../../../components/attendance/employee/ShiftRequestItem';
import { SitePlaces } from '../../../components/shifts/SitePlaces';
import { setLocale } from '../../../i18n/core';
import { pick, renderPage } from '../../../test/companyPages';
import { apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { morning, page, plant, plantRef, weekend } from '../../../test/shifts';
import type { Employee, Shift, ShiftAssignment, ShiftRequest, WorkSite } from '../../../types';
import { SiteFormPage } from '../sites/SiteFormPage';
import { SitesPage } from '../sites/SitesPage';
import { EmployeeShiftsPage } from './EmployeeShiftsPage';
import { ShiftFormPage } from './ShiftFormPage';
import { ShiftRequestsPage } from './ShiftRequestsPage';
import { ShiftsPage } from './ShiftsPage';

const WHEN = { deleted_at: '2026-10-05T16:00:00Z', deleted_by: 'ana@empresa.com' };
const deletedShift: Shift = { ...morning, ...WHEN };
const deletedSite: WorkSite = { ...plant, ...WHEN };
const employee = { id: 7, full_name: 'Ana Ruiz', first_name: 'Ana', last_name: 'Ruiz', employee_number: 'EMP-7', active: true } as Employee;
const cancelled: ShiftAssignment = { id: 12, shift: weekend, valid_from: '2030-11-02', valid_to: null, state: 'SCHEDULED', created_at: '2026-09-01T00:00:00Z', ...WHEN };
const restoredMessage = (what: string) => `${what} restaurado.`;

/** La empresa: turnos, sitios y asignaciones (vigentes o en «Eliminados»), con su restauración. */
function server(current: { shift?: () => Shift; site?: () => WorkSite } = {}) {
  return mockFetch((call: MockCall) => {
    const trash = call.url.includes('deleted=true');
    if (call.url.endsWith('/restore')) {
      if (call.url.startsWith('/api/shift-assignments')) return apiOk({ ...cancelled, deleted_at: null }, { message: restoredMessage('Cambio de turno') });
      return call.url.startsWith('/api/sites') ? apiOk(plant, { message: restoredMessage('Sitio') }) : apiOk(morning, { message: restoredMessage('Turno') });
    }
    if (call.url.startsWith('/api/shifts?')) return apiOk(page(trash ? [deletedShift] : [morning]));
    if (call.url.startsWith('/api/sites?')) return apiOk(page(trash ? [deletedSite] : [plant]));
    if (call.url.startsWith('/api/shifts/')) return apiOk((current.shift ?? (() => deletedShift))());
    if (call.url.startsWith('/api/sites/')) return apiOk((current.site ?? (() => deletedSite))());
    if (call.url.includes('/shift-assignments')) return apiOk(page(trash ? [cancelled] : [{ ...cancelled, deleted_at: null, shift: { ...weekend, deleted: true } }]));
    return apiOk(employee);
  });
}

describe('Turnos y sitios: «Eliminados»', () => {
  it('turnos: el filtro, la fila con cuándo y quién y «Restaurar» con el horario y dónde se checa', async () => {
    const { calls } = server();
    renderPage('/company/shifts', '/company/shifts', <ShiftsPage />);
    await screen.findByText('Matutino');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/shifts?page=1&size=10&deleted=true'));
    const row = (await screen.findByRole('cell', { name: /Se eliminó el/ })).closest('tr') as HTMLElement;
    expect(screen.queryByRole('link', { name: 'Asignar a varios' })).toBeNull();
    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Matutino' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el turno Matutino?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Planta Norte');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Turno restaurado.' })).toBeInTheDocument();
  });

  it('la edición de un turno eliminado es su aviso con «Restaurar»; al restaurarlo vuelve el formulario', async () => {
    let shift = deletedShift;
    const { calls } = server({ shift: () => shift });
    renderPage('/company/shifts/:id/edit', '/company/shifts/5/edit', <ShiftFormPage />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('Turno eliminado');
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    expect(calls.map((call) => call.url)).toEqual(['/api/shifts/5']);
    shift = morning;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Matutino' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar el turno Matutino?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('sitios: el filtro, la fila y la restauración con su domicilio y su radio', async () => {
    const { calls } = server();
    renderPage('/company/sites', '/company/sites', <SitesPage />);
    await screen.findByText('Planta Norte');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/sites?page=1&size=10&deleted=true'));
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar Planta Norte' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el sitio Planta Norte?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Radio100 m');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Sitio restaurado.' })).toBeInTheDocument();
  });

  it('la edición de un sitio eliminado es su aviso con «Restaurar»; al restaurarlo vuelve el formulario', async () => {
    let site = deletedSite;
    server({ site: () => site });
    renderPage('/company/sites/:id/edit', '/company/sites/3/edit', <SiteFormPage />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('Sitio eliminado');
    site = plant;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Planta Norte' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar el sitio Planta Norte?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('los turnos de un empleado: un turno eliminado lleva su marca; los cambios cancelados se restauran', async () => {
    const { calls } = server();
    renderPage('/company/employees/:id/shifts', '/company/employees/7/shifts', <EmployeeShiftsPage />);
    const item = (await screen.findByText('Fin de semana')).closest('li') as HTMLElement;
    expect(within(item).getByText('Eliminado')).toHaveClass('deleted-mark');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/employees/7/shift-assignments?page=1&size=10&deleted=true'));
    expect(await screen.findByText(/Se eliminó el .* por ana@empresa\.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar cambio' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Fin de semana' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el cambio de Ana Ruiz al turno Fin de semana?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Iba a aplicar desde');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio de turno restaurado.' })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/shift-assignments/12/restore')).toBe(true);
  });

  it('sin cambios cancelados: «Nada eliminado»', async () => {
    mockFetch((call) => (call.url.includes('/shift-assignments') ? apiOk(page([])) : apiOk(employee)));
    renderPage('/company/employees/:id/shifts', '/company/employees/7/shifts', <EmployeeShiftsPage />);
    await screen.findByText('Sin turno asignado');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
  });
});

const request: ShiftRequest = {
  id: 31,
  employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', deleted: true },
  shift: { ...weekend, deleted: true },
  current_shift: { ...morning, deleted: true },
  valid_from: '2030-01-07',
  reason: 'Estudio',
  status: 'REJECTED',
  review_note: null,
  reviewed_at: null,
  created_at: '2026-10-01T00:00:00Z',
};

describe('Referencias del historial a registros eliminados', () => {
  it('solicitudes de cambio (empresa): el empleado y los dos turnos llevan su marca', async () => {
    mockFetch(apiOk(page([request])));
    renderWithProviders(<ShiftRequestsPage />);
    const item = (await screen.findByText('Ana Ruiz')).closest('li') as HTMLElement;
    expect(within(item).getAllByText('Eliminado')).toHaveLength(3);
  });

  it('solicitudes del empleado y sitios de un turno: la marca junto al nombre (también en inglés)', async () => {
    const { unmount } = renderWithProviders(<ShiftRequestItem request={request} busy={false} onCancel={() => undefined} />);
    expect(screen.getAllByText('Eliminado')).toHaveLength(2);
    unmount();
    const { rerender } = render(<SitePlaces sites={[{ ...plantRef, deleted: true }, { ...plantRef, id: 4, name: 'Planta Sur' }]} />);
    expect(screen.getAllByText('Eliminado')).toHaveLength(1);
    await setLocale('en-US');
    rerender(<SitePlaces sites={[{ ...plantRef, deleted: true }]} />);
    expect(await screen.findByText('Deleted')).toBeInTheDocument();
  });
});
