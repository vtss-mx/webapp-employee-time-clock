import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { sampleValidator } from '../../test/fixtures';
import { apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { ValidatorDevice } from '../../types';
import { ValidatorDevicesPage } from './ValidatorDevicesPage';

const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const device = (id: number, status: ValidatorDevice['status'], extra: Partial<ValidatorDevice> = {}): ValidatorDevice => ({
  id,
  name: `Tableta ${id}`,
  user_agent: IPAD,
  status,
  created_at: '2026-10-01T09:00:00Z',
  last_seen_at: '2026-10-02T09:00:00Z',
  last_ip: '10.0.0.5',
  reviewed_at: null,
  reviewed_by: null,
  ...extra,
});

function server(devices: ValidatorDevice[]) {
  let items = [...devices];
  return mockFetch((call) => {
    if (call.init.method === 'PATCH') {
      const id = Number(/devices\/(\d+)\/status/.exec(call.url)?.[1]);
      const { status } = JSON.parse(call.init.body as string) as { status: ValidatorDevice['status'] };
      const updated = { ...items.find((d) => d.id === id)!, status, reviewed_by: 'admin@empresa.com', reviewed_at: '2026-10-03T10:00:00Z' };
      items = items.map((d) => (d.id === id ? updated : d));
      return apiOk(updated);
    }
    if (call.url.includes('/devices')) return apiOk({ items, total: items.length, page: 1, size: 10 });
    return apiOk(sampleValidator);
  });
}

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/company/validators/:id/devices" element={<ValidatorDevicesPage />} />
    </Routes>,
    { route: '/company/validators/3/devices' },
  );

describe('ValidatorDevicesPage (COMPANY)', () => {
  it('autoriza uno pendiente, rechaza otro y revoca uno autorizado (con confirmación)', async () => {
    const { calls } = server([device(1, 'PENDING'), device(2, 'PENDING'), device(3, 'APPROVED', { reviewed_by: 'rh@empresa.com' })]);
    renderPage();
    expect(await screen.findByText('Recepción planta 1 · recepcion@empresa.com')).toBeInTheDocument();
    expect(screen.getAllByText('Por autorizar')).toHaveLength(2);
    expect(screen.getByText(/Revisado por rh@empresa.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/IP 10.0.0.5/, { selector: 'small' })).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Autorizar Tableta 1' }));
    expect(await screen.findByText('Dispositivo autorizado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar Tableta 2' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Dispositivo rechazado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Revocar Tableta 3' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Se cerrarán las sesiones abiertas del validador');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Revocar' }));
    expect(await screen.findByText('Autorización revocada')).toBeInTheDocument();

    const patches = calls.filter((c) => c.init.method === 'PATCH');
    expect(patches.map((c) => [c.url, JSON.parse(c.init.body as string) as unknown])).toEqual([
      ['/api/validators/3/devices/1/status', { status: 'APPROVED' }],
      ['/api/validators/3/devices/2/status', { status: 'REJECTED' }],
      ['/api/validators/3/devices/3/status', { status: 'REVOKED' }],
    ]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Autorizar Tableta 3' })).toBeInTheDocument()); // revocado: se puede autorizar de nuevo
  });

  it('sin dispositivos lo explica', async () => {
    server([]);
    renderPage();
    expect(await screen.findByText('No hay dispositivos registrados')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });
});
