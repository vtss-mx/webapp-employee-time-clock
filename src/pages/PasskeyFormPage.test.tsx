import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { WithCatalogs } from '../test/render';
import type { Passkey } from '../types/passkeys';
import * as webauthn from '../utils/webauthn';
import { PASSKEY_NAME_MAX, PasskeyFormPage, validatePasskeyName } from './PasskeyFormPage';

const options = { token: 'sellado-123', options: { challenge: 'cmV0bw', rp: { name: 'Employee Time Clock' }, user: { id: 'MQ', name: 'a', displayName: 'a' }, pubKeyCredParams: [] } };
const credential = { id: 'Y3JlZA', rawId: 'Y3JlZA', type: 'public-key' as const, response: { clientDataJSON: 'AQ', attestationObject: 'Ag', transports: ['internal'] }, authenticatorAttachment: 'platform', clientExtensionResults: {} };
const saved: Passkey = { id: 1, name: 'Mi iPhone', created_at: '2026-10-01T10:00:00Z', last_used_at: null, transports: ['internal'], backed_up: true };

function renderPage(entry: string | { pathname: string; state: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <FeedbackProvider>
        <WithCatalogs>
          <Routes>
            <Route path="/profile" element={<p>Pantalla: Mi perfil</p>} />
            <Route path="/profile/passkeys/new" element={<PasskeyFormPage />} />
            <Route path="/profile/passkeys/:id/rename" element={<PasskeyFormPage />} />
          </Routes>
        </WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

function server(register: Response = apiOk(saved, { status: 201 }), listed: Passkey[] = [saved]) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/auth/passkeys/options')) return apiOk(options);
    if (call.init.method === 'PATCH') return apiOk({ ...saved, name: 'Laptop' });
    if ((call.init.method ?? 'GET') === 'GET') return apiOk({ items: listed, total: listed.length, page: 1, size: 50 });
    return register;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('PasskeyFormPage: registrar una llave de acceso', () => {
  it('valida el nombre (obligatorio y con tope) en el idioma activo', () => {
    expect(validatePasskeyName('  ')).toBe('Escribe un nombre');
    expect(validatePasskeyName('x'.repeat(PASSKEY_NAME_MAX + 1))).toBe(`Máximo ${PASSKEY_NAME_MAX} caracteres`);
    expect(validatePasskeyName(' Mi teléfono ')).toBeUndefined();
  });

  it('propone el nombre del navegador, pregunta, pide la llave al dispositivo, la registra, avisa y vuelve a Mi perfil', async () => {
    const create = vi.spyOn(webauthn, 'createPasskey').mockResolvedValue(credential);
    const { calls } = server();
    renderPage('/profile/passkeys/new');
    const name = screen.getByLabelText(/^Nombre/);
    expect((name as HTMLInputElement).value).toMatch(/·/); // «Chrome · macOS», lo que diga el navegador de pruebas
    await userEvent.clear(name);
    await userEvent.type(name, ' Mi iPhone ');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar llave' }));
    const ask = await screen.findByRole('dialog', { name: '¿Registrar una llave de acceso en este dispositivo?' });
    expect(ask).toHaveTextContent('Mi iPhone');
    expect(create).not.toHaveBeenCalled(); // nada hasta confirmar
    await userEvent.click(within(ask).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByRole('dialog', { name: 'Llave de acceso registrada' })).toHaveTextContent('Ya puedes entrar con ella desde el inicio de sesión.');
    expect(create).toHaveBeenCalledWith(options.options);
    const posted = calls.find((c) => c.url === '/api/auth/passkeys' && c.init.method === 'POST');
    expect(JSON.parse(posted?.init.body as string)).toEqual({ token: 'sellado-123', name: 'Mi iPhone', credential });
    expect(await screen.findByText('Pantalla: Mi perfil')).toBeInTheDocument();
  });

  it('cancelar el aviso del sistema no registra nada ni avisa; el formulario sigue', async () => {
    vi.spyOn(webauthn, 'createPasskey').mockResolvedValue(null);
    const { calls } = server();
    renderPage('/profile/passkeys/new');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar llave' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/auth/passkeys/options'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.url === '/api/auth/passkeys' && c.init.method === 'POST')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar llave' })).toBeEnabled();
  });

  it('una falla del servidor o del dispositivo va al popup y el formulario se puede corregir', async () => {
    vi.spyOn(webauthn, 'createPasskey').mockResolvedValue(credential);
    server(apiFail(409, 'PASSKEY_ALREADY_REGISTERED', 'Esa llave de acceso ya está registrada'));
    renderPage('/profile/passkeys/new');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar llave' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la llave de acceso' })).toHaveTextContent('Esa llave de acceso ya está registrada');
    vi.spyOn(webauthn, 'createPasskey').mockRejectedValue(new webauthn.PasskeyError('failed'));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar llave' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la llave de acceso' })).toHaveTextContent('Tu dispositivo no pudo completar la operación.');
  });

  it('un nombre vacío marca el campo y avisa en popup sin enviar', async () => {
    const { calls } = server();
    renderPage('/profile/passkeys/new');
    const name = screen.getByLabelText(/^Nombre/);
    await userEvent.clear(name);
    expect(screen.getByRole('button', { name: 'Registrar llave' })).toBeDisabled();
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription('Escribe un nombre');
    expect(calls).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Pantalla: Mi perfil')).toBeInTheDocument();
  });
});

describe('PasskeyFormPage: renombrar', () => {
  const existing: Passkey = { ...saved, name: 'Mi teléfono' };

  it('muestra el nombre actual, pide confirmar el cambio (antes → después) y vuelve a Mi perfil', async () => {
    const { calls } = server();
    renderPage({ pathname: '/profile/passkeys/1/rename', state: { passkey: existing } });
    expect(screen.getByRole('heading', { name: 'Renombrar llave de acceso' })).toBeInTheDocument();
    const name = screen.getByLabelText(/^Nombre/);
    expect(name).toHaveValue('Mi teléfono');
    await userEvent.clear(name);
    await userEvent.type(name, 'Laptop');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    const ask = await screen.findByRole('dialog', { name: '¿Renombrar la llave de acceso?' });
    expect(ask).toHaveTextContent('Mi teléfono');
    expect(ask).toHaveTextContent('Laptop');
    await userEvent.click(within(ask).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Nombre guardado' })).toBeInTheDocument();
    const patched = calls.find((c) => c.init.method === 'PATCH');
    expect(patched?.url).toBe('/api/auth/passkeys/1');
    expect(JSON.parse(patched?.init.body as string)).toEqual({ name: 'Laptop' });
    expect(await screen.findByText('Pantalla: Mi perfil')).toBeInTheDocument();
  });

  it('sin cambios avisa y no envía', async () => {
    const { calls } = server();
    renderPage({ pathname: '/profile/passkeys/1/rename', state: { passkey: existing } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toBeInTheDocument();
    expect(calls).toHaveLength(0); // con la llave en el estado de la ruta no se pide nada
  });

  it('abierta desde la URL (a mano o recargada) pide la llave al servidor; si no es de esta cuenta vuelve a Mi perfil', async () => {
    const { calls } = server(undefined, [existing]);
    renderPage('/profile/passkeys/1/rename');
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('Mi teléfono');
    expect(calls[0].url).toContain('/api/auth/passkeys?page=1&size=');
    expect(screen.queryByText('Pantalla: Mi perfil')).toBeNull();
    renderPage('/profile/passkeys/9/rename');
    expect(await screen.findByText('Pantalla: Mi perfil')).toBeInTheDocument();
  });

  it('si la lista no carga, el popup lo explica con «Reintentar» y no se muestra un formulario vacío', async () => {
    mockFetch(apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto'));
    renderPage('/profile/passkeys/1/rename');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar tus llaves de acceso' })).toHaveTextContent('El servidor respondió con un conflicto');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nombre/)).toBeNull();
    expect(screen.queryByText('Pantalla: Mi perfil')).toBeNull();
  });
});
