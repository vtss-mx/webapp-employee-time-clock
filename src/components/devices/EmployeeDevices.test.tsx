import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { employeeDeviceService } from '../../services/employeeDeviceService';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { EmployeeDevice } from '../../types';
import { EmployeeDevices } from './EmployeeDevices';

const device = (id: number, status: EmployeeDevice['status'], extra: Partial<EmployeeDevice> = {}): EmployeeDevice => ({
  id,
  name: `iPhone ${id} · Safari`,
  status,
  first_seen_at: '2026-10-01T15:00:00Z',
  last_seen_at: '2026-10-02T15:00:00Z',
  uses: 1,
  stepped_up_at: null,
  reviewed_at: null,
  reviewed_by: null,
  ...extra,
});

/** El backend de la ficha del empleado 7: sus dispositivos y las decisiones de la empresa. */
function server(devices: EmployeeDevice[], { failPatch = false } = {}) {
  let items = [...devices];
  return mockFetch((call) => {
    if (call.init.method === 'PATCH') {
      if (failPatch) return apiFail(409, 'DEVICE_INVALID_TRANSITION', 'Ese cambio no aplica');
      const id = Number(/devices\/(\d+)\/status/.exec(call.url)?.[1]);
      const { status } = JSON.parse(call.init.body as string) as { status: EmployeeDevice['status'] };
      const updated = { ...items.find((d) => d.id === id)!, status, reviewed_by: 'admin@empresa.com' };
      items = items.map((d) => (d.id === id ? updated : d));
      return apiOk(updated);
    }
    return apiOk({ items, total: items.length, page: 1, size: 10 });
  });
}

const company = () =>
  renderWithProviders(
    <EmployeeDevices
      filterKey="7"
      load={(query, signal) => employeeDeviceService.list(7, query, signal)}
      decide={(item, decision) => employeeDeviceService.setStatus(7, item.id, decision)}
    />,
  );

describe('EmployeeDevices (antifraude 1b, decisión D2)', () => {
  it('la empresa aprueba uno por decidir y revoca uno aprobado; cada decisión se confirma y la lista cambia sin aviso', async () => {
    const { calls } = server([
      device(1, 'PENDING', { uses: 3, stepped_up_at: '2026-10-02T15:05:00Z' }),
      device(2, 'APPROVED', { reviewed_by: 'rh@empresa.com' }),
    ]);
    company();
    expect(await screen.findByText('iPhone 1 · Safari')).toBeInTheDocument();
    expect(screen.getByText(/3 usos · superó un paso más el/)).toBeInTheDocument();
    expect(screen.getByText('Decidió rh@empresa.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar: iPhone 1 · Safari' }));
    const approve = await screen.findByRole('dialog', { name: '¿Aprobar «iPhone 1 · Safari»?' });
    expect(within(approve).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: Por autorizarDespués: Autorizado');
    expect(within(approve).getByRole('region', { name: 'Detalles' })).toHaveTextContent(/Primer uso: .+último uso: .+3 usos/);
    await userEvent.click(within(approve).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(screen.getAllByText('Autorizado')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // sin aviso de más: el cambio ya se ve

    await userEvent.click(screen.getByRole('button', { name: 'Revocar: iPhone 2 · Safari' }));
    const revoke = await screen.findByRole('alertdialog', { name: '¿Revocar «iPhone 2 · Safari»?' });
    expect(revoke).toHaveTextContent('Volverá a tratarse como un dispositivo desconocido');
    await userEvent.click(within(revoke).getByRole('button', { name: 'Revocar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprobar: iPhone 2 · Safari' })).toBeInTheDocument());

    const patches = calls.filter((c) => c.init.method === 'PATCH');
    expect(patches.map((c) => [c.url, JSON.parse(c.init.body as string) as unknown])).toEqual([
      ['/api/employees/7/devices/1/status', { status: 'APPROVED' }],
      ['/api/employees/7/devices/2/status', { status: 'REVOKED' }],
    ]);
  });

  it('cancelar no envía nada; una falla se explica en un popup', async () => {
    const { calls } = server([device(1, 'REJECTED')], { failPatch: true });
    company();
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar: iPhone 1 · Safari' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar: iPhone 1 · Safari' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText('No se pudo actualizar el dispositivo')).toBeInTheDocument();
    expect(screen.getByText('Ese cambio no aplica')).toBeInTheDocument();
  });

  it('el empleado ve los suyos sin acciones; sin dispositivos lo explica', async () => {
    const { calls } = server([device(4, 'PENDING')]);
    renderWithProviders(<EmployeeDevices filterKey="mine" load={(query, signal) => employeeDeviceService.mine(query, signal)} />);
    expect(await screen.findByText('iPhone 4 · Safari')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprobar|Revocar/ })).not.toBeInTheDocument();
    expect(calls[0].url).toBe('/api/users/me/devices?page=1&size=10');
  });

  it('vacío: la empresa y el empleado ven el título y una línea de qué aparecerá (también en inglés)', async () => {
    server([]);
    const view = company();
    expect(await screen.findByText('Sin dispositivos')).toBeInTheDocument();
    expect(document.querySelector('.empty-state__text')).toHaveTextContent('Aquí verás los navegadores y teléfonos usados para checar.');
    view.unmount();
    await act(() => setLocale('en-US'));
    renderWithProviders(<EmployeeDevices filterKey="mine" load={(query, signal) => employeeDeviceService.mine(query, signal)} />);
    expect(await screen.findByText('No devices')).toBeInTheDocument();
    expect(screen.getByText('Browsers and phones used to check in will appear here.')).toBeInTheDocument();
  });

  it('al cambiar de página la anterior se ve atenuada mientras llega la nueva', async () => {
    mockFetch((call) => (call.url.includes('page=2') ? new Promise<Response>(() => undefined) : apiOk({ items: [device(1, 'APPROVED')], total: 12, page: 1, size: 10 })));
    company();
    await screen.findByText('iPhone 1 · Safari');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(screen.getByRole('list')).toHaveClass('is-loading'));
  });

  it('si la lista no carga, el popup lo dice', async () => {
    mockFetch(apiFail(500, 'INTERNAL_ERROR', 'Error interno'));
    company();
    expect(await screen.findByText('No se pudieron cargar los dispositivos')).toBeInTheDocument();
  });
});
