import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOk, mockFetch } from '../../test/http';
import { DeviceKeyError, type DeviceProof } from '../../utils/deviceKey';
import { postFaceCaptures } from './faceUpload';

// La llave real se prueba en `utils/deviceKey.test.ts`; aquí, qué viaja con las capturas según lo que dé.
const key = vi.hoisted(() => ({ proof: vi.fn<(nonce: string, name: string) => Promise<DeviceProof>>() }));
vi.mock('../../utils/deviceKey', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  deviceProof: (nonce: string, name: string) => key.proof(nonce, name),
}));

const anything = (data: unknown): data is unknown => data !== undefined;

afterEach(() => key.proof.mockReset());

describe('envío de capturas (antifraude 1b)', () => {
  it('firma el reto del dispositivo y manda la telemetría de la toma', async () => {
    key.proof.mockResolvedValue({ public_key: 'PUB', nonce: 'reto-1', signature: 'FIRMA', name: '' });
    const { calls } = mockFetch(apiOk({ ok: true }));
    await postFaceCaptures('/verification/face', { frontal: [new Blob(['a'])], deviceNonce: 'reto-1', telemetry: '{"v":1}' }, anything);
    const form = calls[0].init.body as FormData;
    expect([form.get('device_key'), form.get('device_nonce'), form.get('device_signature'), form.get('telemetry')]).toEqual(['PUB', 'reto-1', 'FIRMA', '{"v":1}']);
    expect(key.proof).toHaveBeenCalledWith('reto-1', '');
  });

  it('sin reto no firma nada; si el navegador no puede guardar la llave, se envía sin ella (el servidor lo anota)', async () => {
    const { calls } = mockFetch(apiOk({ ok: true }));
    await postFaceCaptures('/verification/face', { frontal: [new Blob(['a'])] }, anything);
    expect(key.proof).not.toHaveBeenCalled();
    key.proof.mockRejectedValue(new DeviceKeyError());
    await postFaceCaptures('/verification/face', { frontal: [new Blob(['a'])], deviceNonce: 'reto-2' }, anything);
    for (const call of calls) {
      const form = call.init.body as FormData;
      expect([form.get('device_key'), form.get('device_signature'), form.get('telemetry')]).toEqual([null, null, null]);
    }
  });
});

describe('envío de capturas (antifraude 2a)', () => {
  it('con el reto viajan la hoja de la ráfaga, su descripción y el comprobante del destello dictado', async () => {
    const { calls } = mockFetch(apiOk({ ok: true }));
    const sheet = new Blob(['hoja'], { type: 'image/jpeg' });
    await postFaceCaptures(
      '/verification/face',
      { frontal: [new Blob(['a'])], challenge: { id: 'ch-1', images: [new Blob(['t'])] }, flash: [new Blob(['c'])], flashReceipt: 'comprobante', burst: { image: sheet, meta: '{"v":1}' } },
      anything,
    );
    const form = calls[0].init.body as FormData;
    expect([form.get('flash_receipt'), form.get('burst_meta')]).toEqual(['comprobante', '{"v":1}']);
    expect(form.get('burst')).toBeInstanceOf(Blob);
    // Sin ráfaga ni comprobante (la app sin canal o un reto que no los pide) no viaja nada de más.
    await postFaceCaptures('/verification/face', { frontal: [new Blob(['a'])], challenge: { id: 'ch-1', images: [] } }, anything);
    const plain = calls[1].init.body as FormData;
    expect([plain.get('flash_receipt'), plain.get('burst'), plain.get('burst_meta')]).toEqual([null, null, null]);
  });
});
