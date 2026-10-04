import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, tokenResponse } from '../test/render';
import { SessionsPanel } from './SessionsPanel';

const session = (id: string, current: boolean) => ({
  id,
  created_at: new Date().toISOString(),
  last_used_at: new Date().toISOString(),
  expires_at: 'x',
  ip_address: '10.0.0.1',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
  current,
});
/** Teléfono sin IP conocida que no se ha vuelto a usar desde que inició. */
const phone = { ...session('b', false), ip_address: null, last_used_at: null, user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari/604.1' };
const page = (...items: Array<ReturnType<typeof session> | typeof phone>) => apiOk({ items, total: items.length, page: 1, size: 10 });

/** Sesión iniciada (como en "Mi perfil") y el panel con su respuesta del servidor por ruta. */
function renderPanel(routes: Record<string, (call: MockCall) => Response | Promise<Response>>) {
  const server = mockFetch((call) => {
    if (call.url.endsWith('/auth/login')) return apiOk(tokenResponse());
    const path = Object.keys(routes).find((key) => call.url.includes(key));
    return path ? routes[path](call) : apiFail(404, 'NOT_FOUND');
  });
  function Profile() {
    const { login, isAuthenticated } = useAuth();
    useEffect(() => void login('ana@empresa.com', 'Clave123'), [login]);
    return isAuthenticated ? <SessionsPanel /> : <p>Sesión cerrada</p>;
  }
  renderWithProviders(<Profile />, { auth: true });
  return server;
}

const closeEverywhere = () => userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }));

describe('SessionsPanel', () => {
  it('cerrar en todos los dispositivos: "Cancelar" no cierra nada; "Cerrar todas" cierra la sesión sin otro aviso', async () => {
    const { calls } = renderPanel({ '/auth/logout-all': () => apiOk({ revoked: 2 }), '/auth/sessions': () => page(session('a', true)) });
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument();

    await closeEverywhere();
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Cerrar todas las sesiones' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((call) => call.url.endsWith('/auth/logout-all'))).toBe(false);

    await closeEverywhere();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar todas' }));
    expect(await screen.findByText('Sesión cerrada')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('si no se pudo cerrar en todos los dispositivos, avisa y quita la confirmación', async () => {
    renderPanel({ '/auth/logout-all': () => apiFail(503, 'SERVICE_UNAVAILABLE', 'Servicio no disponible'), '/auth/sessions': () => page(session('a', true)) });
    await screen.findByText('Este dispositivo');
    await closeEverywhere();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar todas' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cerrar sesión en todos los dispositivos' });
    expect(popup).toHaveTextContent('Servicio no disponible');
    expect(screen.queryByRole('alertdialog', { name: 'Cerrar todas las sesiones' })).toBeNull();
    expect(screen.getByText('Este dispositivo')).toBeInTheDocument(); // la sesión sigue abierta
  });

  it('al cerrar otra sesión la lista se recarga atenuada (sin esqueleto) hasta tener la respuesta', async () => {
    let answer: (response: Response) => void = () => undefined;
    let loads = 0;
    renderPanel({
      '/auth/sessions/b': () => apiOk(null),
      '/auth/sessions': () => (++loads === 1 ? page(session('a', true), phone) : new Promise<Response>((resolve) => (answer = resolve))),
    });
    await screen.findByText('Este dispositivo');
    expect(screen.getByText(/IP desconocida/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(document.querySelector('.session-list')).toHaveClass('is-loading'));
    answer(page(session('a', true)));
    await waitFor(() => expect(document.querySelector('.session-list')).not.toHaveClass('is-loading'));
    expect(within(document.querySelector('.session-list') as HTMLElement).queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });
});
