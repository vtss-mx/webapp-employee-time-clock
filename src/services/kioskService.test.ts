import { describe, expect, it, vi } from 'vitest';
import { apiOk, envelope, jsonResponse, mockFetch } from '../test/http';
import { DeviceKeyError } from '../utils/deviceKey';
import { kioskService } from './kioskService';

const keys = vi.hoisted(() => ({ sign: vi.fn<(message: string) => Promise<unknown>>() }));
vi.mock('../utils/deviceKey', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  devicePublicKey: () => Promise.resolve('PUB'),
  signMessage: (message: string) => keys.sign(message),
}));

const kioskCode = { site_name: 'Planta', company_name: 'Pan', code: '123456', qr: 'TC-SITE:3:123456', period_seconds: 30, expires_in: 12, device_nonce: 'n2' };
const proofError = (code: string, details: Record<string, unknown> | null) =>
  jsonResponse(envelope(null, { status: 403, code, message: code, errors: [{ code, message: code, field: null, details }] }), 403);
const bodies = (calls: Array<{ init: RequestInit }>) => calls.map((c) => JSON.parse(c.init.body as string) as unknown);

describe('kioskService (público, sin sesión)', () => {
  it('vincula con el código en mayúsculas, la llave pública y el nombre del equipo, sin Authorization', async () => {
    const { calls } = mockFetch(apiOk({ kiosk_id: 5, site_name: 'Planta', company_name: 'Pan', device_nonce: 'n0' }));
    expect(await kioskService.pair(' abcde-23456 ')).toMatchObject({ kiosk_id: 5 });
    expect(bodies(calls)[0]).toMatchObject({ pairing_code: 'ABCDE-23456', public_key: 'PUB' });
    expect(new Headers(calls[0].init.headers).has('Authorization')).toBe(false);
  });

  it('sin llave para firmar pide el código sin prueba; el servidor la vuelve a pedir y el error llega', async () => {
    keys.sign.mockRejectedValue(new DeviceKeyError());
    const { calls } = mockFetch(proofError('KIOSK_PROOF_REQUIRED', { nonce: 'n9' }));
    await expect(kioskService.code(5, 'n1')).rejects.toMatchObject({ code: 'KIOSK_PROOF_REQUIRED' });
    expect(bodies(calls)).toEqual([{ kiosk_id: 5 }, { kiosk_id: 5 }]);
  });

  it('un error que no es de la prueba (o sin reto nuevo) llega tal cual, sin reintentar', async () => {
    keys.sign.mockResolvedValue({ publicKey: 'PUB', signature: 'firma' });
    const { calls } = mockFetch(proofError('KIOSK_PROOF_INVALID', null));
    await expect(kioskService.code(5, 'n1')).rejects.toMatchObject({ code: 'KIOSK_PROOF_INVALID' });
    mockFetch(proofError('SITE_CODE_DISABLED', { nonce: 'n3' }));
    await expect(kioskService.code(5, null)).rejects.toMatchObject({ code: 'SITE_CODE_DISABLED' });
    expect(bodies(calls)).toEqual([{ kiosk_id: 5, nonce: 'n1', signature: 'firma' }]);
    mockFetch(apiOk({ ...kioskCode, code: 5 }));
    await expect(kioskService.code(5, null)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
