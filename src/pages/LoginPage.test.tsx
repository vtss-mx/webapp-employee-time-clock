import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch } from '../test/http';
import { renderWithProviders, sampleUser, tokenResponse } from '../test/render';
import { preferenceStore } from '../utils/storage';
import { DeviceKeyError } from '../utils/deviceKey';
import { LoginPage } from './LoginPage';

const deviceKey = vi.hoisted(() => ({ deviceProof: vi.fn() }));
vi.mock('../utils/deviceKey', async (importOriginal) => ({ ...(await importOriginal<object>()), deviceProof: deviceKey.deviceProof }));

describe('LoginPage: todos los mensajes en popup', () => {
  it('el botón se habilita solo con correo válido y contraseña; el correo inválido se marca al salir', async () => {
    const { calls } = mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE'));
    renderWithProviders(<LoginPage />, { auth: true });
    const button = screen.getByRole('button', { name: 'Iniciar sesión' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@');
    await userEvent.tab();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('Ingresa un correo válido');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave1234');
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'empresa.com');
    expect(button).toBeEnabled();
    expect(calls.some((c) => c.url.endsWith('/auth/login'))).toBe(false); // nunca se envió
    expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  });

  it('credenciales incorrectas: popup (no aviso dentro de la tarjeta)', async () => {
    mockFetch(apiFail(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos'));
    const { container } = renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Mala1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo iniciar sesión' });
    expect(popup).toHaveTextContent('Correo o contraseña incorrectos');
    expect(container.querySelector('.auth-card .alert')).toBeNull();
  });

  it('diseño empresarial: sin panel de marca, con derechos reservados', () => {
    const { container } = renderWithProviders(<LoginPage />, { auth: true });
    expect(container.querySelector('.auth__brand')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText(/Todos los derechos reservados\./)).toHaveTextContent(`© ${new Date().getFullYear()} Employee Time Clock.`);
  });
});

describe('LoginPage: Recordar mi cuenta (dato en la BD)', () => {
  const version = () => jsonResponse({ build: 'test-build' });
  const routes = (remembered: unknown) => (call: { url: string; init: RequestInit }) => {
    if (call.url.includes('version.json')) return version();
    if (call.url.endsWith('/auth/remembered')) return apiOk(call.init.method === 'DELETE' ? null : remembered);
    return apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY' }));
  };
  const loginBody = (calls: Array<{ url: string; init: RequestInit }>) =>
    JSON.parse(calls.find((c) => c.url.endsWith('/auth/login'))?.init.body as string) as { remember: boolean };

  it('desmarcada por defecto: la sesión no se recuerda y nada queda en el navegador', async () => {
    const { calls } = mockFetch(routes(null));
    renderWithProviders(<LoginPage />, { auth: true });
    const remember = screen.getByRole('checkbox', { name: /Recordar mi cuenta/ });
    expect(remember).not.toBeChecked();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña', { selector: 'input' }), 'Clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(preferenceStore.get('tc.signed-in')).toBe('1'));
    expect(loginBody(calls)).toMatchObject({ remember: false });
    expect(JSON.stringify({ ...localStorage })).not.toContain('ana@empresa.com');
  });

  it('marcada: el servidor recuerda la cuenta (nunca la contraseña ni el correo en el navegador)', async () => {
    const { calls } = mockFetch(routes(null));
    renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.click(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ }));
    await userEvent.type(screen.getByLabelText('Correo electrónico'), ' Ana@Empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña', { selector: 'input' }), 'Clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(loginBody(calls)).toMatchObject({ remember: true }));
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toMatch(/Clave1234|ana@empresa/i);
  });

  it('cuenta recordada en el dispositivo: correo escrito, casilla marcada, foco en la contraseña y "Usar otra cuenta"', async () => {
    const { calls } = mockFetch(routes({ email: 'ana@empresa.com' }));
    renderWithProviders(<LoginPage />, { auth: true });
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@empresa.com'));
    expect(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ })).toBeChecked();
    expect(screen.getByLabelText('Contraseña', { selector: 'input' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Usar otra cuenta' }));
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveValue(''));
    expect(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ })).not.toBeChecked();
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus();
    expect(calls.some((c) => c.url.endsWith('/auth/remembered') && c.init.method === 'DELETE')).toBe(true);
  });
});

describe('LoginPage: vista corporativa', () => {
  it('solo marca, tarjeta de acceso y derechos reservados (sin ayuda, recuperación ni enlaces extra)', () => {
    mockFetch(apiOk(null));
    renderWithProviders(<LoginPage />, { auth: true });
    expect(screen.getByRole('banner')).toHaveTextContent('Employee Time Clock');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Todos los derechos reservados');
    expect(screen.getByRole('checkbox', { name: 'Recordar mi cuenta' })).toBeInTheDocument();
    for (const name of ['¿Necesitas ayuda?', '¿Olvidaste tu contraseña?', 'Ayuda']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('link', { name: 'Documentación de la API' })).toBeNull();
    expect(screen.queryByText('Contraseñas protegidas')).toBeNull();
    expect(screen.queryByText(/Sesión de máximo/)).toBeNull();
  });
});

describe('LoginPage: validador que solo opera en su lugar (requiere ubicación)', () => {
  const validatorUser = { ...sampleUser, role: 'VALIDATOR' as const, employee: null };
  const here = { latitude: 29.0734, longitude: -110.9559, accuracy: 12 };
  function stubGeolocation(answer: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: answer }, configurable: true });
  }
  async function submit() {
    renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Valida1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  }
  const loginServer = (...answers: Response[]) =>
    mockFetch((call) => (call.url.endsWith('/auth/login') ? (answers.shift() ?? apiFail(500, 'EXTRA')) : jsonResponse({})));

  it('si el servidor pide la ubicación, la toma (aviso nativo) y reintenta con ella', async () => {
    stubGeolocation((ok) => ok({ coords: here } as GeolocationPosition));
    const { calls } = loginServer(apiFail(403, 'LOCATION_REQUIRED', 'Permite el acceso a tu ubicación.'), apiOk(tokenResponse(validatorUser)));
    await submit();
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/auth/login'))).toHaveLength(2));
    const [first, second] = calls.filter((c) => c.url.endsWith('/auth/login')).map((c) => JSON.parse(c.init.body as string) as Record<string, unknown>);
    expect(first.location).toBeUndefined();
    expect(second.location).toEqual(here);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('permiso de ubicación bloqueado: popup con los pasos para permitirla', async () => {
    stubGeolocation((_ok, fail) => fail({ code: 1 } as GeolocationPositionError));
    loginServer(apiFail(403, 'LOCATION_REQUIRED', 'Permite el acceso a tu ubicación.'));
    await submit();
    const popup = await screen.findByRole('alertdialog', { name: 'Permite el acceso a tu ubicación' });
    expect(within(popup).getByText(/Ajustes › Privacidad › Localización/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('fuera del radio: popup con la distancia que dio el servidor', async () => {
    stubGeolocation((ok) => ok({ coords: here } as GeolocationPosition));
    loginServer(
      apiFail(403, 'LOCATION_REQUIRED', 'Permite el acceso a tu ubicación.'),
      apiFail(403, 'LOCATION_OUT_OF_RANGE', 'Estás a 1.1 km del lugar de este validador. Solo puede iniciar sesión a no más de 100 m de ese punto.'),
    );
    await submit();
    const popup = await screen.findByRole('alertdialog', { name: 'Estás fuera del lugar permitido' });
    expect(popup).toHaveTextContent('Estás a 1.1 km del lugar de este validador');
    expect(within(popup).getByText('Acércate al acceso donde opera este validador.')).toBeInTheDocument();
  });
});

describe('LoginPage: validador en un dispositivo autorizado por su empresa', () => {
  const validatorUser = { ...sampleUser, role: 'VALIDATOR' as const, employee: null };
  const proof = { public_key: 'PUB', nonce: 'reto-1', signature: 'FIRMA', name: 'Safari · iOS' };
  const deviceError = (code: string, message: string, details: Record<string, unknown> = {}) =>
    jsonResponse(envelope(null, { status: 403, code, message, errors: [{ code, message, field: null, details }] }), 403);
  async function submit() {
    renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Valida1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  }
  const loginServer = (...answers: Response[]) =>
    mockFetch((call) => (call.url.endsWith('/auth/login') ? (answers.shift() ?? apiFail(500, 'EXTRA')) : jsonResponse({})));

  it('firma el reto con la llave del dispositivo y entra si la empresa ya lo autorizó', async () => {
    deviceKey.deviceProof.mockResolvedValue(proof);
    const { calls } = loginServer(deviceError('DEVICE_PROOF_REQUIRED', 'Verificando el dispositivo', { nonce: 'reto-1' }), apiOk(tokenResponse(validatorUser)));
    await submit();
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/auth/login'))).toHaveLength(2));
    const second = JSON.parse(calls.filter((c) => c.url.endsWith('/auth/login'))[1].init.body as string) as Record<string, unknown>;
    expect(second.device).toEqual(proof);
    expect(deviceKey.deviceProof).toHaveBeenCalledWith('reto-1', expect.any(String));
  });

  it('dispositivo nuevo: queda por autorizar y se explica qué hacer', async () => {
    deviceKey.deviceProof.mockResolvedValue(proof);
    loginServer(
      deviceError('DEVICE_PROOF_REQUIRED', 'Verificando el dispositivo', { nonce: 'reto-1' }),
      deviceError('DEVICE_PENDING_APPROVAL', 'Este dispositivo quedó registrado como «Safari · iOS» y espera la autorización de tu empresa.'),
    );
    await submit();
    const popup = await screen.findByRole('dialog', { name: 'Dispositivo por autorizar' });
    expect(popup).toHaveTextContent('Safari · iOS');
    expect(within(popup).getByText(/Validadores › Dispositivos/)).toBeInTheDocument();
  });

  it('dispositivo revocado o navegador sin llave: su aviso', async () => {
    deviceKey.deviceProof.mockRejectedValueOnce(new DeviceKeyError());
    loginServer(deviceError('DEVICE_PROOF_REQUIRED', 'Verificando', { nonce: 'reto-1' }));
    await submit();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar el dispositivo' })).toBeInTheDocument();
  });
});
