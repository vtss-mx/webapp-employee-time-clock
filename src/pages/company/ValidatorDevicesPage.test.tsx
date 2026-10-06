import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { sampleValidator } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
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
  it('autoriza uno pendiente, rechaza otro y revoca uno autorizado (cada decisión se confirma)', async () => {
    const { calls } = server([device(1, 'PENDING'), device(2, 'PENDING'), device(3, 'APPROVED', { reviewed_by: 'rh@empresa.com' })]);
    renderPage();
    expect(await screen.findByText('Recepción planta 1 · recepcion@empresa.com')).toBeInTheDocument();
    expect(screen.getAllByText('Por autorizar')).toHaveLength(2);
    expect(screen.getByText(/Revisado por rh@empresa.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/IP 10.0.0.5/, { selector: 'small' })).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Autorizar Tableta 1' }));
    const approve = await screen.findByRole('dialog', { name: '¿Autorizar «Tableta 1»?' });
    expect(approve).toHaveTextContent('El validador podrá iniciar sesión e identificar a tu personal en este dispositivo.');
    expect(within(approve).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: Por autorizarDespués: Autorizado');
    expect(within(approve).getByRole('region', { name: 'Detalles' })).toHaveTextContent(/^EquipoSafari · iOSRegistrado.+$/);
    await userEvent.click(within(approve).getByRole('button', { name: 'Autorizar' }));
    expect(await screen.findByText('Dispositivo autorizado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar Tableta 2' }));
    const reject = await screen.findByRole('alertdialog', { name: '¿Rechazar «Tableta 2»?' });
    expect(within(reject).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: Por autorizarDespués: Rechazado');
    await userEvent.click(within(reject).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Dispositivo rechazado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Revocar Tableta 3' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Revocar «Tableta 3»?' });
    expect(confirm).toHaveTextContent('Se cerrarán las sesiones abiertas del validador');
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: AutorizadoDespués: Revocado');
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
    expect(await screen.findByText('Sin dispositivos')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });
});

describe('ValidatorDevicesPage: tipos de dispositivo, cancelar y páginas', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
  const icon = (name: string) => screen.getByText(name).closest('li')?.querySelector('.icon-tile svg');

  it('cada dispositivo con el ícono de su tipo; sin último acceso ni IP solo dice cuándo se registró', async () => {
    server([
      device(1, 'PENDING', { name: 'Teléfono de recepción', user_agent: IPHONE }),
      device(2, 'PENDING', { name: 'Computadora', user_agent: WINDOWS, last_seen_at: null, last_ip: null }),
      device(3, 'PENDING', { name: 'Equipo sin datos', user_agent: null }),
      device(4, 'REJECTED', { name: 'Tableta vieja', reviewed_by: 'rh@empresa.com', reviewed_at: null }),
    ]);
    renderPage();
    expect(await screen.findByText('Teléfono de recepción')).toBeInTheDocument();
    expect(icon('Teléfono de recepción')).toHaveClass('lucide-smartphone');
    expect(icon('Computadora')).toHaveClass('lucide-monitor-smartphone');
    expect(icon('Equipo sin datos')).toHaveClass('lucide-monitor-smartphone');
    expect(icon('Tableta vieja')).toHaveClass('lucide-tablet');
    expect(screen.getByText('Computadora').closest('li')).not.toHaveTextContent(/Último acceso|IP/);
    expect(screen.getByText('Revisado por rh@empresa.com')).toBeInTheDocument(); // sin fecha de revisión
    expect(screen.getByRole('button', { name: 'Autorizar Tableta vieja' })).toBeInTheDocument(); // rechazado: se puede autorizar
  });

  it('cancelar la confirmación (autorizar o revocar) no cambia el dispositivo', async () => {
    const { calls } = server([device(1, 'APPROVED'), device(2, 'REVOKED', { user_agent: null })]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar Tableta 1' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Revocar «Tableta 1»?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar Tableta 2' }));
    const approve = await screen.findByRole('dialog', { name: '¿Autorizar «Tableta 2»?' });
    expect(within(approve).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: RevocadoDespués: Autorizado');
    expect(within(approve).getByRole('region', { name: 'Detalles' })).toHaveTextContent('EquipoDispositivo desconocido');
    await userEvent.click(within(approve).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(screen.getByRole('button', { name: 'Revocar Tableta 1' })).toBeEnabled();
    expect(screen.getByText('Revocado')).toBeInTheDocument();
  });

  it('al cambiar de página la lista anterior se atenúa mientras llega la siguiente', async () => {
    let release: (response: Response) => void = () => undefined;
    const first = Array.from({ length: 10 }, (_, i) => device(i + 1, 'APPROVED'));
    mockFetch((call) => {
      if (!call.url.includes('/devices')) return apiOk(sampleValidator);
      if (call.url.includes('page=2')) return new Promise<Response>((done) => (release = done));
      return apiOk({ items: first, total: 11, page: 1, size: 10 });
    });
    renderPage();
    const list = (await screen.findByText('Tableta 1')).closest('ul');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(list).toHaveClass('is-loading');
    release(apiOk({ items: [device(11, 'PENDING')], total: 11, page: 2, size: 10 }));
    expect(await screen.findByText('Tableta 11')).toBeInTheDocument();
    expect(screen.getByText('Tableta 11').closest('ul')).not.toHaveClass('is-loading');
  });
});

describe('ValidatorDevicesPage: cada falla se explica con su título', () => {
  it.each([
    ['el validador', (url: string) => !url.includes('/devices'), 'No se pudo cargar el validador'],
    ['sus dispositivos', (url: string) => url.includes('/devices'), 'No se pudieron cargar los dispositivos'],
  ])('%s que no cargan', async (_, failing, title) => {
    mockFetch((call) => (failing(call.url) ? apiFail(403, 'FORBIDDEN', 'Sin acceso') : apiOk(call.url.includes('/devices') ? { items: [], total: 0, page: 1, size: 10 } : sampleValidator)));
    renderPage();
    expect(await screen.findByRole('alertdialog', { name: title })).toHaveTextContent('Sin acceso');
  });

  it('una decisión que el servidor rechaza', async () => {
    mockFetch((call) => {
      if (call.init.method === 'PATCH') return apiFail(409, 'DEVICE_STATUS_CONFLICT', 'El dispositivo ya cambió');
      return apiOk(call.url.includes('/devices') ? { items: [device(1, 'PENDING')], total: 1, page: 1, size: 10 } : sampleValidator);
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar Tableta 1' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Rechazar «Tableta 1»?' })).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo actualizar el dispositivo' })).toHaveTextContent('El dispositivo ya cambió');
  });
});
