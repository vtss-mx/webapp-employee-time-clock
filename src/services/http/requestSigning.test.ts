import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceKeyError } from '../../utils/deviceKey';
import { ApiError } from './envelope';
import { errorDetail, nonceExpiry, sendSigned, signingNonce } from './requestSigning';

// La firma real (WebCrypto + IndexedDB) se prueba en `utils/deviceKey.test.ts`; aquí, cuándo se firma y con qué.
const keys = vi.hoisted(() => ({ sign: vi.fn<(nonce: string, message: string) => Promise<unknown>>() }));
vi.mock('../../utils/deviceKey', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestSignature: (nonce: string, message: string) => keys.sign(nonce, message),
}));

const NOW = Date.parse('2026-10-05T12:00:00Z');
/** Un reto que vence en `seconds` desde NOW (`{vence}.{sal}.{mac}`). */
const nonceIn = (seconds: number, salt = 's') => `${NOW / 1000 + seconds}.${salt}.mac`;
const signatureError = (code: string, nonce?: string) =>
  new ApiError({ statusCode: 403, code, message: `servidor: ${code}`, errors: [{ code, message: code, field: null, details: nonce ? { device_nonce: nonce } : null }] });

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  keys.sign.mockImplementation((nonce: string, message: string) => Promise.resolve({ signature_key: 'KEY', signature_nonce: nonce, signature: `sig(${message})` }));
});
afterEach(() => signingNonce.reset());

describe('firma por petición: el reto', () => {
  it('lee cuándo vence; un reto sin fecha legible no tiene vencimiento conocido', () => {
    expect(nonceExpiry('1790000000.sal.mac')).toBe(1_790_000_000_000);
    expect(nonceExpiry('sal.mac')).toBeNull();
    expect(nonceExpiry('0.sal.mac')).toBeNull();
    expect(nonceExpiry('')).toBeNull();
  });

  it('el detalle de un error: solo textos no vacíos de un ApiError', () => {
    expect(errorDetail(signatureError('SIGNATURE_STALE', 'n2'), 'device_nonce')).toBe('n2');
    expect(errorDetail(signatureError('SIGNATURE_STALE'), 'device_nonce')).toBeNull();
    expect(errorDetail(new ApiError({ statusCode: 403, code: 'X', message: '', errors: [{ code: 'X', message: '', field: null, details: { device_nonce: 5 } }] }), 'device_nonce')).toBeNull();
    expect(errorDetail(new Error('otro'), 'device_nonce')).toBeNull();
  });

  it('sin saber si se firma se pide; apagado no; un reto se renueva al faltar menos del margen', () => {
    expect(signingNonce.stale()).toBe(true);
    signingNonce.remember(undefined); // la respuesta no dijo nada: sigue sin saberse
    expect(signingNonce.stale()).toBe(true);
    signingNonce.remember(null);
    expect([signingNonce.stale(), signingNonce.value()]).toEqual([false, null]);
    signingNonce.remember(nonceIn(300));
    expect(signingNonce.stale()).toBe(false);
    signingNonce.remember(nonceIn(30)); // menos de 60 s
    expect(signingNonce.stale()).toBe(true);
    signingNonce.remember('sin-fecha');
    expect([signingNonce.stale(), signingNonce.value()]).toEqual([false, 'sin-fecha']);
    signingNonce.remember(''); // vacío: no cambia
    expect(signingNonce.value()).toBe('sin-fecha');
  });
});

describe('firma por petición: el envío', () => {
  const digest = () => Promise.resolve('huella');

  it('firma "{reto}.{acción}.{huella}" con el reto vigente, sin pedir otro', async () => {
    signingNonce.remember(nonceIn(300));
    const refresh = vi.fn();
    const send = vi.fn((fields: object) => Promise.resolve(fields));
    expect(await sendSigned('qr', digest, refresh, send)).toEqual({ signature_key: 'KEY', signature_nonce: nonceIn(300), signature: `sig(${nonceIn(300)}.qr.huella)` });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sin reto (aún no se sabe) pide el perfil antes; si falla, sale sin firma (decide el servidor)', async () => {
    const send = vi.fn((fields: object) => Promise.resolve(fields));
    const refresh = vi.fn(() => {
      signingNonce.remember(nonceIn(600, 'nuevo'));
      return Promise.resolve();
    });
    expect(await sendSigned('face', digest, refresh, send)).toMatchObject({ signature_nonce: nonceIn(600, 'nuevo') });
    signingNonce.reset();
    expect(await sendSigned('inspect', digest, () => Promise.reject(new Error('sin red')), send)).toEqual({});
  });

  it('un reto por vencer se renueva; con la empresa sin firma no se firma ni se pide nada', async () => {
    signingNonce.remember(nonceIn(10, 'viejo'));
    const send = vi.fn((fields: object) => Promise.resolve(fields));
    await sendSigned('qr', digest, () => Promise.resolve(signingNonce.remember(nonceIn(600, 'fresco'))), send);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ signature_nonce: nonceIn(600, 'fresco') }));
    signingNonce.remember(null);
    const refresh = vi.fn();
    expect(await sendSigned('qr', digest, refresh, send)).toEqual({});
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sin llave del dispositivo (ventana privada) sale sin firma, sin avisar', async () => {
    signingNonce.remember(nonceIn(300));
    keys.sign.mockRejectedValue(new DeviceKeyError());
    expect(await sendSigned('face', digest, vi.fn(), (fields) => Promise.resolve(fields))).toEqual({});
  });

  it('reto vencido (SIGNATURE_STALE): reintenta UNA vez con el reto nuevo del detalle', async () => {
    signingNonce.remember(nonceIn(300, 'a'));
    const send = vi.fn().mockRejectedValueOnce(signatureError('SIGNATURE_STALE', nonceIn(600, 'b'))).mockResolvedValueOnce('ok');
    expect(await sendSigned('qr', digest, vi.fn(), send)).toBe('ok');
    expect(send.mock.calls.map((args) => (args[0] as { signature_nonce: string }).signature_nonce)).toEqual([nonceIn(300, 'a'), nonceIn(600, 'b')]);
    expect(signingNonce.value()).toBe(nonceIn(600, 'b'));
    // Una segunda vez seguida ya no se reintenta: llega el error.
    send.mockRejectedValue(signatureError('SIGNATURE_STALE', nonceIn(900, 'c')));
    await expect(sendSigned('qr', digest, vi.fn(), send)).rejects.toMatchObject({ code: 'SIGNATURE_STALE' });
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('faltaba la firma porque la empresa no la pedía (reto nulo): reintenta firmando; con reto, el error llega', async () => {
    signingNonce.remember(null);
    const send = vi.fn().mockRejectedValueOnce(signatureError('SIGNATURE_REQUIRED', nonceIn(600))).mockResolvedValueOnce('ok');
    expect(await sendSigned('inspect', digest, vi.fn(), send)).toBe('ok');
    expect(send.mock.calls[1][0]).toMatchObject({ signature_nonce: nonceIn(600) });

    // Ya había reto y aun así faltó (sin llave): no se insiste.
    keys.sign.mockRejectedValue(new DeviceKeyError());
    const unsigned = vi.fn().mockRejectedValue(signatureError('SIGNATURE_REQUIRED', nonceIn(700)));
    await expect(sendSigned('inspect', digest, vi.fn(), unsigned)).rejects.toMatchObject({ code: 'SIGNATURE_REQUIRED' });
    expect(unsigned).toHaveBeenCalledOnce();
  });

  it('otros errores (llave de otro dispositivo, firma inválida, sin reto nuevo) llegan tal cual y guardan el reto que traigan', async () => {
    signingNonce.remember(nonceIn(300));
    const mismatch = signatureError('SIGNATURE_KEY_MISMATCH', nonceIn(800));
    await expect(sendSigned('face', digest, vi.fn(), () => Promise.reject(mismatch))).rejects.toBe(mismatch);
    expect(signingNonce.value()).toBe(nonceIn(800));
    const stale = signatureError('SIGNATURE_STALE');
    await expect(sendSigned('face', digest, vi.fn(), () => Promise.reject(stale))).rejects.toBe(stale);
    const network = new TypeError('Failed to fetch');
    await expect(sendSigned('face', digest, vi.fn(), () => Promise.reject(network))).rejects.toBe(network);
    expect(signingNonce.value()).toBe(nonceIn(800));
  });
});
