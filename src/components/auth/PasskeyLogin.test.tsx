import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../../pages/LoginPage';
import { apiFail, apiOk, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser, tokenResponse } from '../../test/render';
import * as webauthn from '../../utils/webauthn';

const deviceKey = vi.hoisted(() => ({ deviceProof: vi.fn() }));
vi.mock('../../utils/deviceKey', async (importOriginal) => ({ ...(await importOriginal<object>()), deviceProof: deviceKey.deviceProof }));

const options = { token: 'sellado-123', options: { challenge: 'cmV0bw', rpId: 'localhost' } };
const assertion = { id: 'Y3JlZA', rawId: 'Y3JlZA', type: 'public-key' as const, response: { clientDataJSON: 'AQ', authenticatorData: 'Ag', signature: 'Aw', userHandle: 'MQ' }, authenticatorAttachment: 'platform', clientExtensionResults: {} };
const companyUser = { ...sampleUser, role: 'COMPANY' as const, employee: null };

function server(...logins: Response[]) {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('version.json')) return jsonResponse({ build: 'test-build' });
    if (call.url.endsWith('/auth/login/passkey/options')) return apiOk(options);
    if (call.url.endsWith('/auth/login/passkey')) return logins.shift() ?? apiFail(500, 'EXTRA');
    return apiOk(null);
  });
}

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/company/dashboard" element={<p>Pantalla: panel de la empresa</p>} />
    </Routes>,
    { route: '/login', auth: true },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Entrar con llave de acceso (inicio de sesión)', () => {
  it('sin WebAuthn en el navegador el botón no existe', () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(false);
    server();
    renderLogin();
    expect(screen.queryByRole('button', { name: 'Entrar con llave de acceso' })).toBeNull();
  });

  it('pide el reto, el dispositivo firma y entra con la misma sesión (con «Recordar mi cuenta»)', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    const get = vi.spyOn(webauthn, 'getPasskey').mockResolvedValue(assertion);
    const { calls } = server(apiOk(tokenResponse(companyUser)));
    renderLogin();
    await userEvent.click(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    expect(await screen.findByText('Pantalla: panel de la empresa')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(options.options);
    const posted = calls.find((c) => c.url.endsWith('/auth/login/passkey'));
    expect(JSON.parse(posted?.init.body as string)).toEqual({ token: 'sellado-123', credential: assertion, remember: true });
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('cancelar el aviso del sistema no avisa nada ni llama al servidor', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    vi.spyOn(webauthn, 'getPasskey').mockResolvedValue(null);
    const { calls } = server();
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/auth/login/passkey/options'))).toBe(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar con llave de acceso' })).toBeEnabled());
    expect(calls.some((c) => c.url.endsWith('/auth/login/passkey'))).toBe(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('una llave rechazada por el servidor se explica en popup y el formulario vuelve a estar disponible', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    vi.spyOn(webauthn, 'getPasskey').mockResolvedValue(assertion);
    server(apiFail(401, 'PASSKEY_LOGIN_FAILED', 'No se pudo entrar con esa llave de acceso. Intenta de nuevo o usa tu contraseña.'));
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo entrar con la llave de acceso' });
    expect(popup).toHaveTextContent('No se pudo entrar con esa llave de acceso');
    expect(screen.getByRole('button', { name: 'Entrar con llave de acceso' })).toBeEnabled();
  });

  it('una falla del propio dispositivo también va al popup', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    vi.spyOn(webauthn, 'getPasskey').mockRejectedValue(new webauthn.PasskeyError('failed'));
    server();
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo entrar con la llave de acceso' })).toHaveTextContent('Tu dispositivo no pudo completar la operación.');
  });

  it('un validador firma además el reto de su dispositivo cuando el servidor lo pide; por autorizar, su aviso', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    vi.spyOn(webauthn, 'getPasskey').mockResolvedValue(assertion);
    const proof = { public_key: 'PUB', nonce: 'reto-1', signature: 'FIRMA', name: 'Safari · iOS' };
    deviceKey.deviceProof.mockResolvedValue(proof);
    const validator = { ...sampleUser, role: 'VALIDATOR' as const, employee: null };
    const { calls } = server(
      jsonResponse({ success: false, statusCode: 403, code: 'DEVICE_PROOF_REQUIRED', message: 'Falta verificar este dispositivo', data: null, errors: [{ code: 'DEVICE_PROOF_REQUIRED', message: 'x', field: null, details: { nonce: 'reto-1' } }], traceId: 't', timestamp: 'x' }, 403),
      apiOk(tokenResponse(validator)),
    );
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/auth/login/passkey'))).toHaveLength(2));
    const second = JSON.parse(calls.filter((c) => c.url.endsWith('/auth/login/passkey'))[1].init.body as string) as { device: unknown };
    expect(second.device).toEqual(proof);
    expect(deviceKey.deviceProof).toHaveBeenCalledWith('reto-1', expect.any(String));
  });

  it('un dispositivo por autorizar se explica con el aviso del validador (no con el popup genérico)', async () => {
    vi.spyOn(webauthn, 'passkeysSupported').mockReturnValue(true);
    vi.spyOn(webauthn, 'getPasskey').mockResolvedValue(assertion);
    server(apiFail(403, 'DEVICE_PENDING_APPROVAL', 'Este dispositivo quedó registrado y espera la autorización de tu empresa.'));
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));
    expect(await screen.findByRole('dialog', { name: 'Dispositivo por autorizar' })).toBeInTheDocument();
  });
});
