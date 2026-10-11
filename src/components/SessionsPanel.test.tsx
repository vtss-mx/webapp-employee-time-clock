import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { setLocale } from '../i18n/core';
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
    useEffect(() => void login('ana@empresa.com', 'Clave1234569'), [login]);
    return isAuthenticated ? <SessionsPanel /> : <p>Sesión cerrada</p>;
  }
  renderWithProviders(<Profile />, { auth: true });
  return server;
}

const closeEverywhere = () => userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }));
const ALL = '¿Cerrar la sesión en todos tus dispositivos?';

describe('SessionsPanel', () => {
  it('cerrar en todos los dispositivos: "Cancelar" no cierra nada; "Cerrar todas" cierra la sesión sin otro aviso', async () => {
    const { calls } = renderPanel({ '/auth/logout-all': () => apiOk({ revoked: 2 }), '/auth/sessions': () => page(session('a', true)) });
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument();

    await closeEverywhere();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: ALL })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((call) => call.url.endsWith('/auth/logout-all'))).toBe(false);

    await closeEverywhere();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: ALL })).getByRole('button', { name: 'Cerrar todas' }));
    expect(await screen.findByText('Sesión cerrada')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('si no se pudo cerrar en todos los dispositivos, avisa y quita la confirmación', async () => {
    renderPanel({ '/auth/logout-all': () => apiFail(503, 'SERVICE_UNAVAILABLE', 'Servicio no disponible'), '/auth/sessions': () => page(session('a', true)) });
    await screen.findByText('Este dispositivo');
    await closeEverywhere();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: ALL })).getByRole('button', { name: 'Cerrar todas' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cerrar sesión en todos los dispositivos' });
    expect(popup).toHaveTextContent('Servicio no disponible');
    expect(screen.queryByRole('alertdialog', { name: ALL })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' })).toBeEnabled(); // se puede reintentar
    expect(screen.getByText('Este dispositivo')).toBeInTheDocument(); // la sesión sigue abierta
  });

  it('cerrar otra sesión se confirma con su dispositivo e IP; cancelar no la cierra', async () => {
    const { calls } = renderPanel({ '/auth/sessions': () => page(session('a', true), session('c', false)) });
    await screen.findByText('Este dispositivo');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    const confirm = await screen.findByRole('alertdialog', { name: /^¿Cerrar la sesión de .*\?$/ });
    expect(confirm).toHaveTextContent('IP10.0.0.1');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled();
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
    const confirm = await screen.findByRole('alertdialog', { name: /^¿Cerrar la sesión de .*\?$/ });
    expect(confirm).toHaveTextContent('IPDesconocida');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(document.querySelector('.session-list')).toHaveClass('is-loading'));
    answer(page(session('a', true)));
    await waitFor(() => expect(document.querySelector('.session-list')).not.toHaveClass('is-loading'));
    expect(within(document.querySelector('.session-list') as HTMLElement).queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });
});

describe('SessionsPanel en inglés (en-US)', () => {
  it('la confirmación abierta y el aviso de éxito siguen al idioma al cambiarlo en caliente', async () => {
    renderPanel({ '/auth/sessions/c': () => apiOk(null), '/auth/sessions': () => page(session('a', true), session('c', false), phone) });
    await screen.findByText('Este dispositivo');
    const others = screen.getAllByRole('button', { name: 'Cerrar' });
    await userEvent.click(others[0]);
    await screen.findByRole('alertdialog', { name: /^¿Cerrar la sesión de .*\?$/ });
    await act(() => setLocale('en-US'));
    const confirm = screen.getByRole('alertdialog', { name: /^Sign out of .*\?$/ });
    expect(confirm).toHaveTextContent('That device will need to sign in again to use your account.');
    expect(confirm).toHaveTextContent('IP10.0.0.1');
    expect(confirm).toHaveTextContent('Started');
    // La lista también está en inglés.
    expect(screen.getByRole('heading', { name: 'Active sessions' })).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getByText(/Unknown IP · Active .* · Started/)).toBeInTheDocument();
    expect(screen.getByText(/Don't recognize a device\?/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('dialog', { name: 'Session ended' })).toHaveTextContent('That device will need to sign in again.');
  });

  it('si no se pudo cerrar otra sesión, el popup del error lo dice en el idioma activo', async () => {
    renderPanel({ '/auth/sessions/c': () => apiFail(503, 'SERVICE_UNAVAILABLE', 'Servicio no disponible'), '/auth/sessions': () => page(session('a', true), session('c', false)) });
    await screen.findByText('Este dispositivo');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: /^¿Cerrar la sesión de .*\?$/ })).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cerrar la sesión' })).toHaveTextContent('Servicio no disponible');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: "Couldn't end the session" })).toBeInTheDocument();
  });

  it('si la lista no se pudo cargar, el popup lo dice (y sigue al idioma)', async () => {
    renderPanel({ '/auth/sessions': () => apiFail(403, 'FORBIDDEN', 'Sin permiso') });
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus sesiones' })).toHaveTextContent('Sin permiso');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: "Couldn't load your sessions" })).toBeInTheDocument();
  });

  it('sin sesiones: el vacío en inglés', async () => {
    await setLocale('en-US');
    renderPanel({ '/auth/sessions': () => page() });
    expect(await screen.findByText('No open sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out of all devices' })).toBeInTheDocument();
  });
});
