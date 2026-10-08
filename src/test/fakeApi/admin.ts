/**
 * Rutas del ADMIN de la plataforma en el backend falso (ver `core.ts`): empresas, errores, seguridad facial,
 * casos de fraude, cobranza, consumo y rendimiento. Los textos que el backend traduce (nombres de umbrales y de
 * señales, motivos, notas del sistema...) van en los dos idiomas con `say`.
 */
import type {
  AdminVerificationPolicy,
  CompanyAdmin,
  CompanyEmployee,
  ErrorOccurrence,
  ErrorReportDetail,
  FaceLearningSummary,
  FraudCase,
  FraudCaseDetail,
  PlatformStats,
  PolicyChange,
  ServerStatus,
} from '../../types';
import type { CompanyDriftRow, DriftRow, DriftSummary } from '../../types/drift';
import type { FaceSecurityOverview } from '../../types/faceSecurity';
import { account, charge, chargeDetail, companyRow, companyUsage, estimate, overview as billingOverview, payment, preview, routeUsage, statementEntries, usageOverview, usageRow, userUsage } from '../billing';
import { company } from '../companyPages';
import { taxCertificate } from '../documents';
import { riskSignal, sampleAdminPolicy } from '../fixtures';
import { alertDetail, functionRow, overview as performanceOverview, routeRow, series, slowAlert, statement, vitals } from '../performance';
import { get, pageOf, route, say, tx, type Ctx, type Route } from './core';

const companyEmployee: CompanyEmployee = {
  id: 7,
  employee_number: 'EMP-7',
  first_name: 'Ana',
  last_name: 'Ruiz',
  department_name: 'Operaciones Acme',
  email: 'ana@acme.mx',
  phone: '+526621234567',
  active: true,
  face_status: 'APPROVED',
  face_learned_samples: 3,
  face_last_learned_at: '2026-10-04T10:00:00Z',
};

const companyAdmin: CompanyAdmin = { id: 2, email: 'admin@acme.mx', active: true, last_login_at: '2026-10-05T15:00:00Z', created_at: '2026-01-01T00:00:00Z' };

const stats: PlatformStats = { companies: 2, active_companies: 1, employees: 3, company_admins: 3 };

const errorReport = (ctx: Ctx): ErrorReportDetail => ({
  id: 1,
  source: 'HTTP',
  severity: 'CRITICAL',
  status: 'PENDING',
  code: 'INTERNAL_ERROR',
  message: tx(ctx, say({ 'es-MX': 'Ocurrió un error inesperado', 'en-US': 'An unexpected error occurred', 'pt-BR': 'Ocorreu um erro inesperado', 'fr-FR': 'Une erreur inattendue est survenue', 'de-DE': 'Ein unerwarteter Fehler ist aufgetreten', 'it-IT': 'Si è verificato un errore imprevisto', 'es-ES': 'Se ha producido un error inesperado' })),
  http_status: 500,
  method: 'GET',
  location: '/api/catalogs',
  exception_type: 'RuntimeError',
  occurrences: 12,
  reopened: 1,
  first_seen_at: '2026-10-01T10:00:00Z',
  last_seen_at: '2026-10-03T10:00:00Z',
  last_trace_id: 'abc12345trace',
  status_changed_at: null,
  status_changed_by: null,
  detail: 'Traceback (most recent call last):\n  RuntimeError',
});

const occurrence = (ctx: Ctx): ErrorOccurrence => ({
  id: 1,
  occurred_at: '2026-10-03T10:00:00Z',
  trace_id: 'abc12345trace',
  message: tx(ctx, say({ 'es-MX': 'Ocurrió un error inesperado', 'en-US': 'An unexpected error occurred', 'pt-BR': 'Ocorreu um erro inesperado', 'fr-FR': 'Une erreur inattendue est survenue', 'de-DE': 'Ein unerwarteter Fehler ist aufgetreten', 'it-IT': 'Si è verificato un errore imprevisto', 'es-ES': 'Se ha producido un error inesperado' })),
  user_label: 'admin@acme.mx',
  company_name: 'Acme',
  context: null,
});

const server: ServerStatus = {
  status: 'ok',
  components: { database: { status: 'ok' }, face_engine: { status: 'ok' } },
  admission: { limit: 48, bounds: [32, 100], in_flight: 3, waiting: 0, admitted: 1200, shed: 0, latency_ratio: 1.1, top_demand: [{ api: 'GET employees', tier: 'NORMAL', recent_requests: 40, latency_ms: 12.5, shed: 0 }] },
  storage: { configured: true, backend: 'gcs', bucket: 'acme-bucket', prefix: 'prod', reason: null, count_cap: 10000, images: [], tasks: [] },
};

const driftSummary: DriftSummary = {
  window_days: 7,
  psi_alert: 0.2,
  tail_drop_alert: 0.15,
  min_samples: 200,
  quick_review_seconds: 30,
  quick_approval_ratio: 0.8,
  weeks: ['2026-09-28', '2026-09-21'],
  latest_week: '2026-09-28',
  alerts: 1,
  insufficient: 3,
  companies_alerted: 1,
  platforms: ['IOS_SAFARI', 'ANDROID_CHROME', 'DESKTOP', 'OTHER'],
  versions: [{ id: 1, component: 'risk_engine', version: '1.2.0', noted_at: '2026-09-29T03:00:00Z' }],
  computed_at: '2026-10-05T03:00:00Z',
};

const driftRow = (ctx: Ctx): DriftRow => ({
  id: 1,
  week_start: '2026-09-28',
  signal: 'LIVENESS_YAW',
  signal_name: tx(ctx, say({ 'es-MX': 'Giro mínimo de la cabeza', 'en-US': 'Minimum head turn', 'pt-BR': 'Giro mínimo da cabeça', 'fr-FR': 'Rotation minimale de la tête', 'de-DE': 'Erforderliche Drehung des Kopfes', 'it-IT': 'Rotazione minima della testa', 'es-ES': 'Giro mínimo de la cabeza' })),
  platform: 'IOS_SAFARI',
  samples: 420,
  baseline_samples: 390,
  median: 0.21,
  baseline_median: 0.3,
  tail: 0.15,
  baseline_tail: 0.26,
  tail_percentile: 10,
  tail_change: -0.42,
  psi: 0.31,
  status: 'ALERT',
  upper: false,
  computed_at: '2026-10-05T03:00:00Z',
});

const companyDrift: CompanyDriftRow = {
  id: 1,
  week_start: '2026-09-28',
  company_id: 1,
  company_name: 'Acme',
  attempts: 1200,
  fraud_cases: 3,
  case_rate: 0.0025,
  reviews: 12,
  approved: 11,
  quick_approvals: 10,
  quick_rate: 0.83,
  status: 'ALERT',
  computed_at: '2026-10-05T03:00:00Z',
};

const faceSecurity = (ctx: Ctx): FaceSecurityOverview => ({
  autocalibration: true,
  window_days: 30,
  min_samples: 300,
  interval_hours: 6,
  thresholds: [
    { key: 'LIVENESS_YAW', name: tx(ctx, say({ 'es-MX': 'Giro mínimo de la cabeza', 'en-US': 'Minimum head turn', 'pt-BR': 'Giro mínimo da cabeça', 'fr-FR': 'Rotation minimale de la tête', 'de-DE': 'Erforderliche Drehung des Kopfes', 'it-IT': 'Rotazione minima della testa', 'es-ES': 'Giro mínimo de la cabeza' })), value: 0.21, floor: 0.18, cap: 0.28, samples: 420, computed_at: '2026-10-04T12:00:00Z', raised: true },
    { key: 'FLASH_SCORE', name: tx(ctx, say({ 'es-MX': 'Respuesta mínima al destello de colores', 'en-US': 'Minimum response to the color flash', 'pt-BR': 'Resposta mínima ao flash de cores', 'fr-FR': 'Réponse minimale au flash coloré', 'de-DE': 'Erforderliche Reaktion auf den farbigen Blitz', 'it-IT': 'Risposta minima al lampo di colori', 'es-ES': 'Respuesta mínima al destello de colores' })), value: 0.35, floor: 0.35, cap: 0.75, samples: 0, computed_at: null, raised: false },
  ],
  escalation_min_attacks: 5,
  escalation_window_minutes: 30,
  reinforced: [{ company_id: 1, name: 'Acme', attacks: 7 }],
  flash: { measured: 120, conclusive: 100, inconclusive: 20, score_median: 0.62, score_p10: 0.3, magnitude_median: 0.012, ratio_median: 1.8, ratio_p10: 1.4 },
  ip_database: { refresh_enabled: true, refresh_days: 30, country: { database_type: 'DBIP-Country-Lite', built_at: '2026-10-01T00:00:00Z' }, asn: null },
});

const fraudCase = (ctx: Ctx): FraudCase => ({
  id: 1,
  company_id: 1,
  company_name: 'Acme',
  status: 'OPEN',
  kind: 'PRESENTATION',
  reason: 'SPOOF_DETECTED',
  reason_name: tx(ctx, say({ 'es-MX': 'Posible foto o pantalla', 'en-US': 'Possible photo or screen', 'pt-BR': 'Possível foto ou tela', 'fr-FR': 'Photo ou écran possible', 'de-DE': 'Mögliches Foto oder möglicher Bildschirm', 'it-IT': 'Possibile foto o schermo', 'es-ES': 'Posible foto o pantalla' })),
  employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' },
  actor: 'ana@acme.mx',
  attempts: 2,
  max_score: 72,
  tier: 'HIGH',
  evidence: 1,
  created_at: '2026-10-01T10:00:00Z',
  last_attempt_at: '2026-10-02T10:00:00Z',
  decided_by: null,
  decided_at: null,
  decision_note: null,
});

const fraudDetail = (ctx: Ctx): FraudCaseDetail => ({
  ...fraudCase(ctx),
  attempts_detail: [
    {
      id: 1,
      attempted_at: '2026-10-01T10:00:00Z',
      success: false,
      reason: 'SPOOF_DETECTED',
      score: 72,
      action: 'DENY',
      signals: [
        {
          code: 'SPOOF_PROB_LOW',
          name: tx(ctx, say({ 'es-MX': 'Probabilidad de rostro real baja', 'en-US': 'Low real-face probability', 'pt-BR': 'Probabilidade baixa de rosto real', 'fr-FR': 'Faible probabilité de visage réel', 'de-DE': 'Geringe Wahrscheinlichkeit eines echten Gesichts', 'it-IT': 'Bassa probabilità di volto reale', 'es-ES': 'Probabilidad de rostro real baja' })),
          description: tx(ctx, say({ 'es-MX': 'La prueba de rostro real pasó, pero quedó cerca de su umbral.', 'en-US': 'The real-face check passed, but close to its threshold.', 'pt-BR': 'A verificação de rosto real passou, mas ficou perto do limite.', 'fr-FR': 'Le contrôle de visage réel a réussi, mais près de son seuil.', 'de-DE': 'Die Prüfung auf ein echtes Gesicht wurde bestanden, lag aber nahe am Schwellenwert.', 'it-IT': 'La verifica del volto reale è riuscita, ma vicino alla soglia.', 'es-ES': 'La prueba de rostro real pasó, pero quedó cerca de su umbral.' })),
          points: 20,
          mode: 'ENFORCE',
          kind: 'PRESENTATION',
          value: 0.07,
          threshold: 0.25,
        },
      ],
      metrics: { frontal_real_min: 0.01 },
      signatures: 2,
      // El nombre que dio el sistema operativo a la cámara (en su idioma): la app lo muestra con el suyo.
      camera: 'Back Ultra Wide Camera',
      ip_address: '52.95.1.10',
      network: { country: 'US', asn: 16509, organization: 'Amazon.com, Inc.', hosting: true },
      user_agent: 'Safari',
    },
  ],
  events: [{ id: 1, created_at: '2026-10-01T10:00:00Z', kind: 'OPENED', actor: null, status_from: null, status_to: null, note: null }],
  evidence_items: [{ id: 11, kind: 'FRONTAL', position: 0, created_at: '2026-10-01T10:00:00Z' }],
});

const policy = (ctx: Ctx): AdminVerificationPolicy => ({
  ...sampleAdminPolicy,
  risk_signals: [
    riskSignal('SPOOF_PROB_LOW', { name: tx(ctx, say({ 'es-MX': 'Probabilidad de rostro real baja', 'en-US': 'Low real-face probability', 'pt-BR': 'Probabilidade baixa de rosto real', 'fr-FR': 'Faible probabilité de visage réel', 'de-DE': 'Geringe Wahrscheinlichkeit eines echten Gesichts', 'it-IT': 'Bassa probabilità di volto reale', 'es-ES': 'Probabilidad de rostro real baja' })), mode: 'ENFORCE', default_mode: 'ENFORCE', confirmed: 2, false_positive: 1 }),
    riskSignal('REPLAY_PERCEPTUAL', { name: tx(ctx, say({ 'es-MX': 'Reenvío perceptual', 'en-US': 'Perceptual replay', 'pt-BR': 'Reenvio perceptual', 'fr-FR': 'Capture renvoyée', 'de-DE': 'Erneut gesendete Aufnahme', 'it-IT': 'Acquisizione inviata di nuovo', 'es-ES': 'Reenvío perceptual' })), kind: 'REPLAY', hard: true, points: 60, default_points: 60 }),
  ],
});

const policyChange: PolicyChange = {
  id: 2,
  status: 'PENDING',
  relaxes: true,
  preset: null,
  changes: [{ field: 'site_codes', before: 'OBSERVE', after: 'OFF', relaxes: true }],
  reason: null,
  simulation: null,
  requested_by: 'root@acme.mx',
  requested_by_me: false,
  created_at: '2026-10-05T10:00:00Z',
  expires_at: '2026-10-08T10:00:00Z',
  decided_by: null,
  decided_at: null,
  decision_note: null,
};

const learning: FaceLearningSummary = { enabled: true, approved_employees: 40, employees_learning: 12, learned_samples: 30, identifications: 400, learned_identifications: 90, last_learned_at: '2026-10-01T10:00:00Z' };

/** La cuenta de cobranza con la nota de una suspensión automática (texto del sistema, en el idioma de quien lee). */
const billingAccount = (ctx: Ctx) => ({
  ...account,
  suspension: account.suspension && { ...account.suspension, note: tx(ctx, say({ 'es-MX': 'El cargo 1 siguió sin pagarse después de 10 días de gracia.', 'en-US': 'Charge 1 was still unpaid after 10 grace days.', 'pt-BR': 'A cobrança 1 continuou sem pagamento após 10 dias de carência.', 'fr-FR': "L'échéance 1 est restée impayée après 10 jours de grâce.", 'de-DE': 'Die Gebühr 1 blieb nach 10 Tagen Nachfrist unbezahlt.', 'it-IT': "L'addebito 1 è rimasto non pagato dopo 10 giorni di tolleranza.", 'es-ES': 'El cargo 1 siguió sin pagarse después de 10 días de gracia.' })) },
});

export function adminRoutes(): Route[] {
  return [
    get('/admin/stats', () => stats),
    get('/admin/companies', () => pageOf([{ ...company, id: 1, name: 'Acme', legal_name: 'Acme SA de CV' }])),
    get('/admin/companies/:id', () => ({ ...company, id: 1, name: 'Acme', legal_name: 'Acme SA de CV' })),
    get('/admin/companies/:id/admins', () => pageOf([companyAdmin])),
    get('/admin/companies/:id/admins/:adminId', () => companyAdmin),
    get('/admin/companies/:id/employees', () => pageOf([companyEmployee])),
    get('/admin/companies/:id/documents', () => pageOf([taxCertificate])),
    get('/admin/companies/:id/verification-policy', (ctx) => policy(ctx)),
    get('/admin/companies/:id/verification-policy/changes', () => pageOf([policyChange])),
    get('/admin/companies/:id/face-learning', () => learning),
    get('/admin/errors/summary', () => ({ by_status: { PENDING: 1, RESOLVED: 4 }, open_by_severity: { CRITICAL: 1 }, pending: 1, last_seen_at: '2026-10-03T10:00:00Z' })),
    get('/admin/errors/server', () => server),
    get('/admin/errors', (ctx) => pageOf([errorReport(ctx)], { as_of: '2026-10-03T12:00:00Z' })),
    get('/admin/errors/:id', (ctx) => errorReport(ctx)),
    get('/admin/errors/:id/occurrences', (ctx) => pageOf([occurrence(ctx)])),
    get('/admin/face-security', (ctx) => faceSecurity(ctx)),
    // Deriva de señales (antifraude fase 3): el resumen, la semana más reciente y las empresas.
    get('/admin/drift/summary', () => driftSummary),
    get('/admin/drift', (ctx) => pageOf([driftRow(ctx)], { week_start: '2026-09-28' })),
    get('/admin/drift/companies', () => pageOf([companyDrift], { week_start: '2026-09-28' })),
    get('/admin/fraud-cases/count', () => ({ active: 1 })),
    get('/admin/fraud-cases', (ctx) => pageOf([fraudCase(ctx)])),
    get('/admin/fraud-cases/:id', (ctx) => fraudDetail(ctx)),
    get('/admin/billing/overview', () => billingOverview),
    route('POST', '/admin/billing/preview', () => preview, true),
    get('/admin/billing/companies', () => pageOf([companyRow])),
    get('/admin/billing/companies/:id', (ctx) => billingAccount(ctx)),
    get('/admin/billing/companies/:id/estimate', () => estimate),
    get('/admin/billing/companies/:id/charges', () => pageOf([charge])),
    get('/admin/billing/companies/:id/charges/:chargeId', () => chargeDetail),
    get('/admin/billing/companies/:id/payments', () => pageOf([payment])),
    get('/admin/billing/companies/:id/statement', () => pageOf(statementEntries)),
    get('/admin/usage/overview', () => usageOverview),
    get('/admin/usage/companies', () => pageOf([usageRow])),
    get('/admin/usage/companies/:id', () => companyUsage),
    get('/admin/usage/companies/:id/users', () => pageOf([userUsage])),
    get('/admin/usage/companies/:id/routes', () => pageOf([routeUsage])),
    get('/admin/performance/overview', () => performanceOverview),
    get('/admin/performance/metrics', (ctx) => pageOf([ctx.query.get('kind') === 'FUNCTION' ? functionRow : routeRow], { kind: ctx.query.get('kind') ?? 'ROUTE', period: '24h', sort: 'p95' })),
    get('/admin/performance/metrics/series', () => series),
    get('/admin/performance/web-vitals', () => pageOf([vitals], { period: '24h' })),
    get('/admin/performance/statements', () => pageOf([statement], { available: true })),
    get('/admin/performance/alerts/summary', () => ({ open: 1, acknowledged: 0, latest: { id: 1, route: 'GET /api/employees', opened_at: '2026-10-05T10:00:00Z', last_ms: 1200 } })),
    get('/admin/performance/alerts', () => pageOf([slowAlert], { as_of: '2026-10-05T12:00:00Z' })),
    get('/admin/performance/alerts/:id', () => alertDetail),
  ];
}
