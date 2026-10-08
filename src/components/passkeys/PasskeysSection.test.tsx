import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Passkey } from '../../types/passkeys';
import * as webauthn from '../../utils/webauthn';
import { PasskeysSection, passkeyFacts } from './PasskeysSection';

const synced: Passkey = { id: 1, name: 'Mi teléfono', created_at: '2026-10-01T10:00:00Z', last_used_at: '2026-10-05T08:00:00Z', transports: ['internal'], backed_up: true };
const local: Passkey = { id: 2, name: 'Laptop del trabajo', created_at: '2026-10-02T10:00:00Z', last_used_at: null, transports: ['usb'], backed_up: false };

function server(passkeys: Passkey[] = [synced, local], revoke: Response = apiOk(null), list?: Response) {
  return mockFetch((call: MockCall) => (call.init.method === 'DELETE' ? revoke : (list ?? apiOk({ items: passkeys, total: passkeys.length, page: 1, size: 10 }))));
}

function renderSection() {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<PasskeysSection />} />
      <Route path="/profile/passkeys/new" element={<p>Pantalla: nueva llave</p>} />
      <Route path="/profile/passkeys/:id/rename" element={<p>Pantalla: renombrar</p>} />
    </Routes>,
    { route: '/profile' },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PasskeysSection (Mi perfil → Llaves de acceso)', () => {
  it('lista las llaves con su nombre, si están sincronizadas y cuándo se usaron; ofrece agregar una', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    server();
    renderSection();
    expect(await screen.findByText('Mi teléfono')).toBeInTheDocument();
    expect(screen.getByText('Sincronizada en la nube')).toBeInTheDocument();
    expect(screen.getByText('Solo en un dispositivo')).toBeInTheDocument();
    expect(screen.getByText(passkeyFacts(local))).toHaveTextContent('Sin usar todavía');
    expect(passkeyFacts(synced)).toMatch(/^Creada el .+ · Último uso: .+$/);
    expect(screen.getByRole('link', { name: 'Agregar llave de acceso' })).toHaveAttribute('href', '/profile/passkeys/new');
    expect(screen.queryByText(/Este navegador no admite/)).toBeNull();
  });

  it('sin WebAuthn en el navegador lo dice y no ofrece agregar (las llaves se siguen viendo)', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(false);
    server([synced]);
    renderSection();
    expect(await screen.findByText('Mi teléfono')).toBeInTheDocument();
    expect(screen.getByText(/Este navegador no admite llaves de acceso/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agregar llave de acceso' })).toBeNull();
  });

  it('sin llaves: estado vacío con ícono, título y descripción', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    server([]);
    renderSection();
    expect(await screen.findByRole('status')).toHaveTextContent('Sin llaves de acceso');
    expect(screen.getByRole('status')).toHaveTextContent('Agrega una para entrar con el rostro, la huella o el PIN.');
  });

  it('renombrar abre su pantalla con la llave', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    server();
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Renombrar: Mi teléfono' }));
    expect(await screen.findByText('Pantalla: renombrar')).toBeInTheDocument();
  });

  it('revocar pregunta con la llave y su uso; cancelar no envía nada; confirmar revoca, avisa y recarga', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    const { calls } = server();
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar: Laptop del trabajo' }));
    const ask = await screen.findByRole('alertdialog', { name: '¿Revocar «Laptop del trabajo»?' });
    expect(ask).toHaveTextContent('Esa llave dejará de servir para entrar, en todos tus dispositivos.');
    expect(ask).toHaveTextContent('No se puede deshacer. Puedes registrar otra cuando quieras.');
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Revocar: Laptop del trabajo' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revocar llave' }));
    expect(await screen.findByRole('dialog', { name: 'Llave de acceso revocada' })).toBeInTheDocument();
    const deleted = calls.find((c) => c.init.method === 'DELETE');
    expect(deleted?.url).toBe('/api/auth/passkeys/2');
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/auth/passkeys') && (c.init.method ?? 'GET') === 'GET')).toHaveLength(2));
  });

  it('si la lista no carga, el popup lo explica con «Reintentar»', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    server([], apiOk(null), apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto'));
    renderSection();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus llaves de acceso' })).toHaveTextContent('El servidor respondió con un conflicto');
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });

  it('si revocar falla, el error va al popup', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    server([synced], apiFail(404, 'PASSKEY_NOT_FOUND', 'Llave de acceso no encontrada'));
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar: Mi teléfono' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revocar llave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo revocar la llave de acceso' })).toHaveTextContent('Llave de acceso no encontrada');
  });
});
