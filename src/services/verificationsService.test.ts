import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import type { CompanyVerification, VerificationDetail, VerificationSummary } from '../types/verifications';
import { adminVerificationsService, verificationsBase, verificationsService } from './verificationsService';

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
/** El periodo consultado y el tope del conteo los envía SIEMPRE el servidor (regla 25). */
const PERIOD = { since: '2026-09-07T06:00:00Z', until: '2026-10-07T06:00:00Z', count_cap: 10_000 };
const page = { items: [row], total: 1, page: 1, size: 10, ...PERIOD };

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
    mockFetch(apiOk({ items: [{ id: 1 }], total: 1, page: 1, size: 10, ...PERIOD }));
    await expect(verificationsService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('historial de verificaciones (la misma implementación para las dos pantallas)', () => {
  const summary: VerificationSummary = {
    ...PERIOD,
    total: 3,
    succeeded: 2,
    failed: 1,
    located: 3,
    by_method: [{ method: 'FACE', total: 3, succeeded: 2 }],
    by_reason: [{ reason: 'NO_MATCH', total: 1 }],
    by_risk_tier: [{ tier: 'HIGH', total: 1 }],
    count_cap: 10_000,
    filterable_risk_tiers: ['MEDIUM', 'HIGH', 'CRITICAL'],
    window_days: 30,
  };
  const detail = { id: 1, created_at: '2026-10-07T10:00:00Z', method: 'FACE', success: true, place: {} } as unknown as VerificationDetail;

  it('las dos bases son la de la plataforma y la de la empresa', () => {
    expect(verificationsBase).toEqual({ admin: '/admin/verifications', company: '/verifications' });
  });

  it('el resumen viaja con los mismos filtros del listado', async () => {
    const { calls } = mockFetch(apiOk(summary));
    await expect(verificationsService.summary({ start: '2026-10-01', risk_tier: 'HIGH' })).resolves.toEqual(summary);
    expect(calls[0].url).toContain('/api/verifications/summary?');
    expect(calls[0].url).toContain('risk_tier=HIGH');
  });

  it('el detalle pide el intento por su id', async () => {
    const { calls } = mockFetch(apiOk(detail));
    await expect(verificationsService.detail(42)).resolves.toEqual(detail);
    expect(calls[0].url).toContain('/api/verifications/42');
  });

  it('el ADMIN usa la base de la plataforma en las tres lecturas', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.includes('/summary')) return apiOk(summary);
      if (/verifications\/\d+/.test(call.url)) return apiOk({ ...detail, company_id: 1, company_name: 'Acme' });
      return apiOk({ items: [{ ...row, company_id: 1, company_name: 'Acme' }], total: 1, page: 1, size: 10, ...PERIOD });
    });
    await expect(adminVerificationsService.list({ page: 1, size: 10, company_id: 3 })).resolves.toMatchObject({ total: 1 });
    await adminVerificationsService.summary({});
    await adminVerificationsService.detail(7);
    expect(calls.map((c) => c.url.split('?')[0])).toEqual(['/api/admin/verifications', '/api/admin/verifications/summary', '/api/admin/verifications/7']);
    expect(calls[0].url).toContain('company_id=3');
  });

  it('una página sin el periodo o sin el tope del conteo se rechaza (la app no los puede inventar)', async () => {
    mockFetch(apiOk({ items: [row], total: 1, page: 1, size: 10 }));
    await expect(verificationsService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    mockFetch(apiOk({ items: [row], total: 1, page: 1, size: 10, since: PERIOD.since, until: PERIOD.until }));
    await expect(verificationsService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('una fila del ADMIN sin su empresa se rechaza', async () => {
    mockFetch(apiOk({ items: [row], total: 1, page: 1, size: 10, ...PERIOD }));
    await expect(adminVerificationsService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('un resumen o un detalle con otra forma se rechazan', async () => {
    mockFetch(apiOk({ total: 1 }));
    await expect(verificationsService.summary({})).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    mockFetch(apiOk({ id: 1 }));
    await expect(verificationsService.detail(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});


describe('frontera de evidencia histórica de verificación', () => {
  const old = { id: 1, created_at: '2026-10-07T10:00:00Z', method: 'FACE', success: true, place: {} };
  it.each([
    { trace_id: 42 }, { trace_id: 'x'.repeat(65) },
    { kiosk_id: '4' }, { kiosk_id: 0 }, { kiosk_id: 1.5 },
    { api_key_prefix: false }, { api_key_prefix: 'x'.repeat(17) },
    { match_thresholds: [] }, { match_thresholds: { fused: '0.8' } },
    { challenge_actions: 'LOOK_UP' }, { challenge_actions: [4] },
    { model_name: 4 }, { policy_version: {} },
  ])('rechaza una evidencia inválida %j sin romper el detalle', async (invalid) => {
    mockFetch(apiOk({ ...old, ...invalid }));
    await expect(verificationsService.detail(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([
    {},
    { trace_id: null, kiosk_id: null, api_key_prefix: null, match_thresholds: null, challenge_actions: null, model_name: null, policy_version: null },
    { trace_id: 'x'.repeat(64), kiosk_id: 4, api_key_prefix: 'x'.repeat(16), match_thresholds: { fused: 0, sface: 0.8 }, challenge_actions: ['LOOK_UP', 'LOOK_UP'], model_name: 'sface', policy_version: 'old' },
    { match_thresholds: {}, challenge_actions: [] },
  ])('conserva el registro válido sin inferencias %j', async (evidence) => {
    const value = { ...old, ...evidence };
    mockFetch(apiOk(value));
    await expect(verificationsService.detail(1)).resolves.toEqual(value);
  });
});


describe('etapas técnicas del intento', () => {
  const module = { code: 'CAPTURE', status: 'ERROR', mandatory: true, duration_ms: 0, reason: null, score: 0, version: 'ivp-verification-1' };
  const capture = { kind: 'FRONTAL', index: 0, sha256: 'a'.repeat(64), bytes: 1024 };
  const flow = { version: 'ivp-verification-1', method: 'FACE', session_id: null, policy_version: 'historical-policy', modules: [module], capture_manifest: [capture] };
  const detail = { id: 1, created_at: '2026-10-10T10:00:00Z', method: 'FACE', success: false, place: {} };
  it.each([undefined, null, flow, { ...flow, method: 'QR', session_id: 'session', modules: [], capture_manifest: [] }])('conserva evidencia válida y la ausencia histórica %j', async (flow_trace) => {
    const value = { ...detail, flow_trace };
    mockFetch(apiOk(value));
    await expect(verificationsService.detail(1)).resolves.toEqual(value);
  });
  it.each([
    [], {}, { ...flow, version: 4 }, { ...flow, method: 'UNKNOWN' }, { ...flow, session_id: 1 }, { ...flow, policy_version: false },
    { ...flow, modules: {} }, { ...flow, modules: [null] },
    ...[{ code: 'UNKNOWN' }, { code: 1 }, { status: 'APPROVED' }, { status: 1 }, { mandatory: null }, { duration_ms: -1 }, { duration_ms: Infinity }, { duration_ms: '1' }, { reason: {} }, { score: -0.1 }, { score: 1.1 }, { score: '0.8' }, { version: null }].map((bad) => ({ ...flow, modules: [{ ...module, ...bad }] })),
    { ...flow, capture_manifest: {} }, { ...flow, capture_manifest: [null] },
    ...[{ kind: 1 }, { index: -1 }, { index: 0.5 }, { index: '0' }, { sha256: 'unknown' }, { sha256: 1 }, { bytes: -1 }, { bytes: 1.5 }, { bytes: '1' }].map((bad) => ({ ...flow, capture_manifest: [{ ...capture, ...bad }] })),
  ])('rechaza evidencia malformada sin conceder una aprobación %j', async (flow_trace) => {
    mockFetch(apiOk({ ...detail, flow_trace }));
    await expect(verificationsService.detail(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
