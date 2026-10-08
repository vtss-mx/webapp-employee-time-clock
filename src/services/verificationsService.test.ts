import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import type { CompanyVerification } from '../types/verifications';
import { verificationsService } from './verificationsService';

const row: CompanyVerification = {
  id: 1,
  created_at: '2026-10-07T10:00:00Z',
  method: 'FACE',
  success: true,
  reason: null,
  confidence: 0.99,
  employee_id: 7,
  employee_number: 'EMP-7',
  employee_name: 'Ana Ruiz',
  avatar: null,
  latitude: 29.1,
  longitude: -110.9,
  location_accuracy_m: 12,
};
const page = { items: [row], total: 1, page: 1, size: 10 };

describe('verificationsService (empresa: verificaciones con su ubicación)', () => {
  it('lista con sus filtros; la empresa sale de la sesión (nunca viaja un company_id del cliente)', async () => {
    const { calls } = mockFetch(apiOk(page));
    await expect(
      verificationsService.list({ page: 1, size: 10, success: false, start: '2026-10-01', end: '2026-10-07', employee_id: 7 }),
    ).resolves.toEqual(page);
    const url = calls[0].url;
    expect(url).toContain('/api/verifications?');
    for (const part of ['page=1', 'size=10', 'success=false', 'start=2026-10-01', 'end=2026-10-07', 'employee_id=7']) {
      expect(url).toContain(part);
    }
    expect(url).not.toContain('company_id');
  });

  it('sin filtros opcionales no los agrega a la consulta', async () => {
    const { calls } = mockFetch(apiOk(page));
    await verificationsService.list({ page: 1, size: 10 });
    expect(calls[0].url).not.toContain('success');
    expect(calls[0].url).not.toContain('start');
  });

  it('rechaza una respuesta que no es una página de verificaciones', async () => {
    mockFetch(apiOk({ items: [{ id: 1 }], total: 1, page: 1, size: 10 }));
    await expect(verificationsService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
