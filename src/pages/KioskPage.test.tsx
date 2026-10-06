import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders } from '../test/render';
import { kioskService } from '../services/kioskService';
import { DeviceKeyError } from '../utils/deviceKey';
import { KioskPage } from './KioskPage';

// Lo del dispositivo se prueba aparte (`deviceKey`, `deviceStore`, `useQrImage`); aquí, qué hace la tableta.
const device = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  publicKey: vi.fn(() => Promise.resolve('PUB')),
}));
vi.mock('../utils/deviceStore', () => ({
  deviceStore: {
    get: (key: string) => Promise.resolve(device.store.get(key)),
    set: (key: string, value: unknown) => Promise.resolve(void device.store.set(key, value)),
  },
}));
vi.mock('../utils/deviceKey', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  devicePublicKey: () => device.publicKey(),
  signMessage: (message: string) => Promise.resolve({ publicKey: 'PUB', signature: `sig(${message})` }),
}));
vi.mock('../hooks/useQrImage', () => ({
  useQrImage: (text: string) => ({ src: text.endsWith('000000') ? null : `data:image/png,${text}`, error: null, retry: () => undefined }),
}));

const code = (digits: string, extra: object = {}) =>
  apiOk({ site_name: 'Planta Norte', company_name: 'Panificadora', code: digits, qr: `TC-SITE:3:${digits}`, period_seconds: 30, expires_in: 30, device_nonce: `n-${digits}`, ...extra });
const failure = (status: number, errorCode: string, details: Record<string, unknown> | null = null) =>
  jsonResponse(envelope(null, { status, code: errorCode, message: `Servidor: ${errorCode}`, errors: [{ code: errorCode, message: errorCode, field: null, details }] }), status);
const body = (call: MockCall) => JSON.parse(call.init.body as string) as Record<string, unknown>;
const codeCalls = (calls: MockCall[]) => calls.filter((c) => c.url === '/api/kiosk/code').map(body);

/** El servidor: vincular responde `pair`; cada código, la siguiente respuesta de `codes` (la última se repite). */
function serve(codes: Array<() => Response>, pair: () => Response = () => apiOk({ kiosk_id: 5, site_name: 'Planta Norte', company_name: 'Panificadora', device_nonce: 'n0' })) {
  let next = 0;
  return mockFetch((call) => {
    if (call.url === '/api/kiosk/pair') return pair();
    const respond = codes[Math.min(next, codes.length - 1)];
    next += 1;
    return respond();
  });
}

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) =>
  act(() => {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  });
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const renderKiosk = () => renderWithProviders(<KioskPage />, { route: '/kiosk', auth: true });

beforeEach(() => {
  device.store.clear();
  device.publicKey.mockImplementation(() => Promise.resolve('PUB'));
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  window.history.replaceState(null, '', '/');
});
afterEach(() => vi.useRealTimers());

describe('Kiosco del sitio: vinculación', () => {
  it('sin vincular: el código se escribe (mayúsculas y guion solos), se confirma y la tableta muestra el código del sitio', async () => {
    const { calls } = serve([() => code('123456')]);
    renderKiosk();
    const field = await screen.findByLabelText('Código de vinculación');
    const pair = screen.getByRole('button', { name: 'Vincular' });
    expect(pair).toBeDisabled();
    await userEvent.type(field, 'abcde 2345');
    expect(field).toHaveValue('ABCDE-2345');
    expect(pair).toBeDisabled();
    fireEvent.submit(field.closest('form') as HTMLFormElement); // incompleto: no pregunta ni envía
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.type(field, '67');
    expect(field).toHaveValue('ABCDE-23456');
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    const confirm = await screen.findByRole('dialog', { name: '¿Vincular esta tableta?' });
    expect(confirm).toHaveTextContent('Código de vinculaciónABCDE-23456');
    expect(calls).toHaveLength(0);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Vincular' }));

    expect(await screen.findByLabelText('1 2 3 4 5 6')).toHaveTextContent('123456');
    expect(screen.getByText('Planta Norte')).toBeInTheDocument();
    expect(screen.getByText('Panificadora')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR del código del sitio' })).toHaveAttribute('src', 'data:image/png,TC-SITE:3:123456');
    expect(screen.getByText(/Se renueva en/)).toBeInTheDocument();
    expect(body(calls[0])).toEqual({ pairing_code: 'ABCDE-23456', public_key: 'PUB', name: expect.any(String) as string });
    expect(codeCalls(calls)).toEqual([{ kiosk_id: 5, nonce: 'n0', signature: 'sig(n0.kiosk.5)' }]);
    expect(device.store.get('kiosk')).toEqual({ kiosk_id: 5 });
  });

  it('un enlace con #pair= llena el código y lo borra de la dirección; aunque ya estuviera vinculada, pide confirmar', async () => {
    device.store.set('kiosk', { kiosk_id: 7 });
    window.history.replaceState(null, '', '/kiosk?x=1#pair=ABCDE-23456');
    const { calls } = serve([() => code('123456')]);
    renderKiosk();
    expect(await screen.findByLabelText('Código de vinculación')).toHaveValue('ABCDE-23456');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
    expect(calls).toHaveLength(0);
  });

  it('un código equivocado o una tableta sin llave (ventana privada) lo explican y dejan el formulario', async () => {
    serve([() => code('123456')], () => failure(422, 'KIOSK_PAIRING_INVALID'));
    renderKiosk();
    const field = await screen.findByLabelText('Código de vinculación');
    await userEvent.type(field, 'ABCDE23456');
    const send = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Vincular' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Vincular esta tableta?' })).getByRole('button', { name: 'Vincular' }));
    };
    await send();
    const error = await screen.findByRole('alertdialog', { name: 'No se pudo vincular la tableta' });
    expect(error).toHaveTextContent('Servidor: KIOSK_PAIRING_INVALID');
    await userEvent.click(within(error).getByRole('button', { name: 'Entendido' }));
    device.publicKey.mockRejectedValue(new DeviceKeyError());
    await send();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo vincular la tableta' })).toHaveTextContent('no permite');
    expect(field).toHaveValue('ABCDE-23456');
  });
});

describe('Kiosco del sitio: el código', () => {
  it('firma el reto que pide el servidor sin avisar, cambia el código al vencer y se detiene con la pantalla oculta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    device.store.set('kiosk', { kiosk_id: 5 });
    const { calls } = serve([() => failure(403, 'KIOSK_PROOF_REQUIRED', { nonce: 'n1' }), () => code('123456'), () => code('654321'), () => code('111222')]);
    renderKiosk();
    expect(await screen.findByLabelText('1 2 3 4 5 6')).toBeInTheDocument();
    expect(codeCalls(calls)).toEqual([{ kiosk_id: 5 }, { kiosk_id: 5, nonce: 'n1', signature: 'sig(n1.kiosk.5)' }]);

    await tick(30_000);
    expect(await screen.findByLabelText('6 5 4 3 2 1')).toBeInTheDocument();
    expect(codeCalls(calls)[2]).toEqual({ kiosk_id: 5, nonce: 'n-123456', signature: 'sig(n-123456.kiosk.5)' });

    setVisibility('hidden');
    await tick(60_000);
    setVisibility('hidden'); // otro aviso de la pestaña, aún oculta: sigue en pausa
    await tick(10);
    expect(codeCalls(calls)).toHaveLength(3); // nadie lo ve: no se piden códigos
    setVisibility('visible');
    expect(await screen.findByLabelText('1 1 1 2 2 2')).toBeInTheDocument();
  });

  it('sin conexión: al vencer el código dice "Sin conexión" y reintenta con espera creciente; al volver la red, al instante', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    device.store.set('kiosk', { kiosk_id: 5 });
    let online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    let attempts = 0;
    const { calls } = mockFetch(() => {
      attempts += 1;
      if (attempts === 1) return code('123456', { expires_in: 10 });
      if (attempts <= 4) return Promise.reject(new TypeError('Failed to fetch'));
      return code('999888');
    });
    renderKiosk();
    expect(await screen.findByLabelText('1 2 3 4 5 6')).toBeInTheDocument();
    online = false;
    await tick(10_000);
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeInTheDocument();
    expect(screen.getByText('Planta Norte')).toBeInTheDocument(); // el sitio sigue a la vista
    expect(calls).toHaveLength(2);
    online = true;
    await tick(2_000); // primera espera
    expect(calls).toHaveLength(3);
    await tick(3_500); // la segunda es el doble (4 s)
    expect(calls).toHaveLength(3);
    online = false;
    await tick(600);
    expect(calls).toHaveLength(4);
    act(() => void window.dispatchEvent(new Event('online'))); // volvió la red: no espera los 8 s
    expect(await screen.findByLabelText('9 9 9 8 8 8')).toBeInTheDocument();
  });

  it('sitio con el código desactivado: aviso tranquilo con el mensaje del servidor y vuelve a preguntar con calma', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    device.store.set('kiosk', { kiosk_id: 5 });
    const { calls } = serve([() => failure(409, 'SITE_CODE_DISABLED'), () => code('000000')]);
    renderKiosk();
    expect(await screen.findByRole('heading', { name: 'Código del sitio en pausa' })).toBeInTheDocument();
    expect(screen.getByText('Servidor: SITE_CODE_DISABLED')).toBeInTheDocument();
    await tick(119_000);
    expect(calls).toHaveLength(1);
    await tick(1_000);
    expect(await screen.findByLabelText('0 0 0 0 0 0')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR del código del sitio' })).toBeNull(); // aún se dibuja
  });

  it('kiosco eliminado o sin vincular: olvida qué kiosco era, vuelve a la vinculación y lo explica', async () => {
    device.store.set('kiosk', { kiosk_id: 5 });
    serve([() => failure(404, 'KIOSK_NOT_FOUND')]);
    renderKiosk();
    expect(await screen.findByRole('alertdialog', { name: 'Esta tableta ya no está vinculada' })).toHaveTextContent('Servidor: KIOSK_NOT_FOUND');
    expect(screen.getByLabelText('Código de vinculación')).toHaveValue('');
    await waitFor(() => expect(device.store.get('kiosk')).toBeNull());
  });

  it('una falla inesperada se trata como pasajera: "Sin conexión" y se reintenta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    device.store.set('kiosk', { kiosk_id: 5 });
    serve([() => code('123456')]);
    vi.spyOn(kioskService, 'code').mockRejectedValueOnce(new Error('inesperado'));
    renderKiosk();
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeInTheDocument();
    await tick(2_000);
    expect(await screen.findByLabelText('1 2 3 4 5 6')).toBeInTheDocument();
  });

  it('salir mientras se pide un código o antes de saber qué kiosco es no deja nada pendiente', async () => {
    device.store.set('kiosk', { kiosk_id: 5 });
    const pending = mockFetch((call) => new Promise<Response>((_resolve, reject) => call.init.signal?.addEventListener('abort', () => reject(new DOMException('cancelada', 'AbortError')))));
    const view = renderKiosk();
    await waitFor(() => expect(pending.calls).toHaveLength(1));
    view.unmount(); // se cancela la petición y el ciclo termina sin tocar la pantalla
    renderKiosk().unmount(); // ni siquiera se leyó qué kiosco era
    expect(pending.calls).toHaveLength(1);
  });

  it('salir de la pantalla detiene el ciclo (nada queda pidiendo códigos)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    device.store.set('kiosk', { kiosk_id: 5 });
    visibility = 'hidden';
    const { calls } = serve([() => code('123456')]);
    const view = renderKiosk();
    await tick(10);
    view.unmount();
    setVisibility('visible');
    await tick(10);
    expect(calls).toHaveLength(0);
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    serve([() => code('123456')]);
    renderKiosk();
    expect(await screen.findByRole('heading', { name: 'Pair this tablet' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pairing code')).toBeInTheDocument();
    expect(screen.getByText('Site kiosk')).toBeInTheDocument();
  });
});
