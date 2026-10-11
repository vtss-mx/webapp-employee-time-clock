import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { accessReviewService } from './accessReviewService';
import { auditService } from './auditService';
import { continuityService } from './continuityService';
import { dataExportService } from './dataExportService';

const event = { id: 1, occurred_at: '2026-10-05T10:00:00Z', action: 'LOGIN_SUCCEEDED', outcome: 'OK' };
const period = { since: '2026-09-28T00:00:00Z', until: '2026-10-05T23:59:59Z' };
const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({ items, total: items.length, page: 1, size: 10, ...extra });
const summary = { ...period, total: 1, by_action: [{ action: 'LOGIN_SUCCEEDED', outcome: 'OK', total: 1 }], dropped: 0, pending: 0, retention_days: 730 };

const account = { id: 2, email: 'admin@acme.mx', role: 'COMPANY', active: true, created_at: '2026-01-01T00:00:00Z' };
const controls = { mfa_required_for: ['ADMIN'], mfa_grace_days: 14, password_min_length: 12, stale_days: 90 };
const reviewSummary = { generated_at: '2026-10-05T16:00:00Z', accounts: 1, by_role: { COMPANY: 1 }, stale: 0, locked: 0, privileged: 1, controls };
const csv = { filename: 'accesos.csv', content_type: 'text/csv', data: 'ZQ==', rows: 1, limit: 5000, generated_at: reviewSummary.generated_at };

const drill = { id: 1, kind: 'PITR', started_at: '2026-10-01T02:00:00Z', success: true, target_rto_minutes: 30, target_rpo_seconds: 60, met_targets: true };
const continuity = { rto_minutes: 30, rpo_seconds: 60, drill_interval_days: 90, backup_upload_enabled: true, pitr_enabled: true, overdue_count: 0, drills: [{ kind: 'PITR', overdue: false }] };

const exported = {
  generated_at: '2026-10-06T15:00:00Z',
  scope: 'SELF',
  subject_email: 'ana@acme.mx',
  company_id: 1,
  company_name: 'Acme',
  next_export_at: '2026-10-07T15:00:00Z',
  row_count: 1,
  truncated: false,
  sections: [{ name: 'account', source: 'auth.users', rows: [], truncated: false }],
  withheld: [{ source: 'biometrics.capture_traces', reason: 'BIOMETRIC' }],
  retention: { biometrics_days: 1095, attendance_metadata_days: 180, verification_log_days: 365, attendance_days: 1825, deleted_records_days: 365 },
};

describe('auditService (bitácora de auditoría, solo el ADMIN)', () => {
  it('la página lleva los filtros y el periodo que de verdad se consultó', async () => {
    const { calls } = mockFetch(apiOk(page([event], period)));
    await expect(auditService.list({ action: 'LOGIN_SUCCEEDED', search: 'ana', since: period.since }, { page: 1, size: 10 })).resolves.toMatchObject({ since: period.since });
    expect(calls[0].url).toBe('/api/admin/audit?page=1&size=10&since=2026-09-28T00%3A00%3A00Z&action=LOGIN_SUCCEEDED&search=ana');
  });

  it('un filtro vacío no viaja (lo decide el servidor con su periodo por omisión)', async () => {
    const { calls } = mockFetch(apiOk(page([event], period)));
    await auditService.list({}, { page: 2, size: 20 });
    expect(calls[0].url).toBe('/api/admin/audit?page=2&size=20');
  });

  it('el resumen se agrupa en el servidor y la exportación va por cursor', async () => {
    const { calls } = mockFetch(apiOk(summary), apiOk({ items: [event], next_cursor: 'c2', ...period }));
    await expect(auditService.summary({ outcome: 'DENIED', company_id: 3, entity_type: 'user', entity_id: '2', until: period.until, actor_email: 'a@b.mx' })).resolves.toEqual(summary);
    await expect(auditService.exportChunk({}, 'c1')).resolves.toMatchObject({ next_cursor: 'c2' });
    expect(calls[0].url).toBe(`/api/admin/audit/summary?until=${encodeURIComponent(period.until)}&actor_email=a%40b.mx&outcome=DENIED&company_id=3&entity_type=user&entity_id=2`);
    expect(calls[1].url).toBe('/api/admin/audit/export?cursor=c1');
    // El primer tramo se pide sin cursor.
    await auditService.exportChunk({}, null);
    expect(calls[2].url).toBe('/api/admin/audit/export');
  });

  it('rechaza una respuesta con otra forma (sin periodo, sin conteos o sin tramo)', async () => {
    mockFetch(apiOk(page([event])), apiOk({ ...summary, by_action: 'x' }), apiOk({ ...period, items: [{ id: 1 }] }));
    await expect(auditService.list({}, { page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(auditService.summary({})).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(auditService.exportChunk({}, null)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('accessReviewService (revisión de accesos, solo el ADMIN)', () => {
  it('el listado, el resumen con sus controles y la exportación llevan los mismos filtros', async () => {
    const { calls } = mockFetch(apiOk(page([account])), apiOk(reviewSummary), apiOk(csv));
    await expect(accessReviewService.list({ role: 'ADMIN', without_mfa: true, stale: true, locked: true, company_id: 2, search: 'ana' }, { page: 1, size: 10 })).resolves.toMatchObject({ total: 1 });
    await expect(accessReviewService.summary()).resolves.toEqual(reviewSummary);
    await expect(accessReviewService.export({ without_mfa: true })).resolves.toEqual(csv);
    expect(calls[0].url).toBe('/api/admin/access-review?page=1&size=10&role=ADMIN&company_id=2&without_mfa=true&stale=true&locked=true&search=ana');
    expect(calls[1].url).toBe('/api/admin/access-review/summary');
    expect(calls[2].url).toBe('/api/admin/access-review/export?without_mfa=true');
  });

  it('un interruptor apagado no viaja', async () => {
    const { calls } = mockFetch(apiOk(page([account])));
    await accessReviewService.list({ without_mfa: false, stale: false, locked: false }, { page: 1, size: 10 });
    expect(calls[0].url).toBe('/api/admin/access-review?page=1&size=10');
  });

  it('rechaza un resumen sin controles o sin conteo por rol, y una exportación sin archivo', async () => {
    mockFetch(apiOk({ ...reviewSummary, controls: { mfa_required_for: [] } }), apiOk({ ...reviewSummary, by_role: null }), apiOk({ filename: 'x.csv' }));
    await expect(accessReviewService.summary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(accessReviewService.summary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(accessReviewService.export({})).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('continuityService (continuidad, solo el ADMIN)', () => {
  it('el compromiso y el historial de ensayos, filtrable por mecanismo', async () => {
    const { calls } = mockFetch(apiOk(continuity), apiOk(page([drill])));
    await expect(continuityService.overview()).resolves.toEqual(continuity);
    await expect(continuityService.drills({ page: 1, size: 10, kind: 'PITR' })).resolves.toMatchObject({ total: 1 });
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/continuity', '/api/admin/continuity/drills?page=1&size=10&kind=PITR']);
  });

  it('rechaza un compromiso sin ensayos declarados o un ensayo sin su meta', async () => {
    mockFetch(apiOk({ ...continuity, drills: 'x' }), apiOk(page([{ id: 1, kind: 'PITR' }])));
    await expect(continuityService.overview()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(continuityService.drills({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('dataExportService (derecho de acceso y de portabilidad)', () => {
  it('el titular y su empresa reciben la misma forma, con el mensaje del servidor', async () => {
    const { calls } = mockFetch(apiOk(exported, { message: 'Tus datos personales' }), apiOk({ ...exported, scope: 'COMPANY' }, { message: 'Datos del empleado' }));
    await expect(dataExportService.mine()).resolves.toEqual({ data: exported, message: 'Tus datos personales' });
    await expect(dataExportService.employee(7)).resolves.toMatchObject({ message: 'Datos del empleado' });
    expect(calls.map((c) => c.url)).toEqual(['/api/me/export', '/api/employees/7/export']);
  });

  it('NO se reintenta sola: el límite por titular se gastaría con un reintento automático', async () => {
    const { calls } = mockFetch(apiFail(429, 'EXPORT_TOO_SOON', 'Estos datos se exportaron hace poco.', { 'Retry-After': '3600' }));
    await expect(dataExportService.mine()).rejects.toMatchObject({ code: 'EXPORT_TOO_SOON', status: 429, retryAfterMs: 3_600_000 });
    expect(calls).toHaveLength(1);
  });

  it('una sesión sin empresa recibe 403 COMPANY_REQUIRED y una respuesta con otra forma se rechaza', async () => {
    mockFetch(apiFail(403, 'COMPANY_REQUIRED'), apiOk({ ...exported, withheld: 'x' }));
    await expect(dataExportService.mine()).rejects.toMatchObject({ code: 'COMPANY_REQUIRED', status: 403 });
    await expect(dataExportService.employee(7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
