import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { faceSecurityService } from './faceSecurityService';

const overview = { thresholds: [], reinforced: [], flash: { measured: 0 } };

describe('faceSecurityService (solo el ADMIN)', () => {
  it('lee la seguridad facial y recalcula con el mensaje del servidor (cuántos umbrales cambiaron)', async () => {
    const { calls } = mockFetch(apiOk(overview), apiOk(overview, { code: 'THRESHOLDS_RECALIBRATED', message: 'Umbrales recalculados: sin cambios' }));
    await expect(faceSecurityService.overview()).resolves.toEqual(overview);
    await expect(faceSecurityService.recalibrate()).resolves.toEqual({ overview, message: 'Umbrales recalculados: sin cambios' });
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url])).toEqual([
      ['GET', '/api/admin/face-security'],
      ['POST', '/api/admin/face-security/recalibrate'],
    ]);
  });

  it('rechaza una respuesta sin umbrales, empresas o destello', async () => {
    mockFetch(apiOk({ thresholds: [] }), apiOk({ reinforced: [] }));
    await expect(faceSecurityService.overview()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(faceSecurityService.recalibrate()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
