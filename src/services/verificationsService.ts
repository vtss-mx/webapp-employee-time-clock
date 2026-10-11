import type {
  CompanyVerification,
  CompanyVerificationPage,
  CompanyVerificationQuery,
  VerificationDetail,
  VerificationFilters,
  VerificationHistoryList,
  VerificationHistoryRow,
  VerificationSummary,
} from '../types/verifications';
import { hasKeys, isPage, isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';

const isVerification = hasKeys<CompanyVerification>('id', 'created_at', 'method', 'success');
const isRow = hasKeys<VerificationHistoryRow>('id', 'created_at', 'method', 'success', 'company_id', 'company_name');
const isSummary = hasKeys<VerificationSummary>('total', 'succeeded', 'failed', 'by_method', 'count_cap', 'window_days');
const hasDetail = hasKeys<VerificationDetail>('id', 'created_at', 'method', 'success', 'place');
const optional = (value: unknown, valid: (value: unknown) => boolean) => value == null || valid(value);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown) => typeof value === 'string';
const moduleCodes = new Set(['SESSION', 'POLICY', 'AUTHORIZATION', 'CAPTURE', 'LIVENESS', 'MATCH', 'RISK', 'WEIGHTED_RISK']);
const moduleStatuses = new Set(['PASS', 'FAIL', 'ERROR', 'TIMEOUT', 'NOT_SUPPORTED', 'SKIPPED_BY_POLICY', 'NOT_APPLICABLE']);
/** Solo evidencia válida del servidor: no completa el pasado ni deduce una aprobación. */
const isFlowTrace = (v: unknown) => isRecord(v) && text(v.version) &&
  (v.method === 'FACE' || v.method === 'QR') && (v.session_id === null || text(v.session_id)) && text(v.policy_version) &&
  Array.isArray(v.modules) && v.modules.every((m: unknown) => isRecord(m) && text(m.code) && moduleCodes.has(m.code) &&
    text(m.status) && moduleStatuses.has(m.status) && typeof m.mandatory === 'boolean' &&
    finite(m.duration_ms) && (m.duration_ms as number) >= 0 && (m.reason === null || text(m.reason)) &&
    (m.score === null || (finite(m.score) && (m.score as number) >= 0 && (m.score as number) <= 1)) && text(m.version)) &&
  Array.isArray(v.capture_manifest) && v.capture_manifest.every((c: unknown) => isRecord(c) && text(c.kind) &&
    finite(c.index) && Number.isSafeInteger(c.index) && (c.index as number) >= 0 &&
    text(c.sha256) && /^[a-f0-9]{64}$/.test(c.sha256) &&
    finite(c.bytes) && Number.isSafeInteger(c.bytes) && (c.bytes as number) >= 0);
const isDetail = (value: unknown): value is VerificationDetail =>
  hasDetail(value) &&
  optional(value.flow_trace, isFlowTrace) &&
  optional(value.trace_id, (v) => text(v) && v.length <= 64) &&
  optional(value.kiosk_id, (v) => finite(v) && Number.isInteger(v) && (v as number) > 0) &&
  optional(value.api_key_prefix, (v) => text(v) && v.length <= 16) &&
  optional(value.match_thresholds, (v) => isRecord(v) && Object.values(v).every(finite)) &&
  optional(value.challenge_actions, (v) => Array.isArray(v) && v.every(text)) &&
  optional(value.model_name, text) &&
  optional(value.policy_version, text);

/** Una página con el periodo consultado y el tope del conteo (los dos los envía el servidor, regla 25). */
const isPeriodPage = <T>(item: (value: unknown) => value is T) => {
  const page = isPage(item);
  return (value: unknown): value is { items: T[]; total: number; page: number; size: number; since: string; until: string; count_cap: number } =>
    page(value) && isRecord(value) && typeof value.since === 'string' && typeof value.until === 'string' && typeof value.count_cap === 'number';
};

/** Las dos bases del historial: la de la plataforma (ADMIN, todas las empresas) y la de la empresa (su sesión). */
export const verificationsBase = { admin: '/admin/verifications', company: '/verifications' } as const;

/**
 * Historial de verificaciones de identidad: UNA implementación para las dos pantallas que lo leen (regla 6), con la
 * misma forma de respuesta y los mismos filtros; lo único que cambia es la base de la ruta, y con ella el alcance,
 * que decide el servidor (el ADMIN ve todas las empresas; la empresa, SOLO la suya, que sale de su sesión: el
 * `company_id` del cliente nunca viaja en el camino de la empresa).
 *
 * Nunca llegan fotos del registro facial ni datos biométricos (regla 13): números, códigos y veredictos, más la
 * ruta versionada de la foto de PERFIL (`avatar`), que la app dibuja con `Avatar`.
 */
function historyService(base: string) {
  return {
    /** Una página del historial con sus filtros (el servidor pagina y acota el periodo). */
    list(query: CompanyVerificationQuery & VerificationFilters, signal?: AbortSignal): Promise<CompanyVerificationPage> {
      return apiRequest<CompanyVerificationPage>(base, { query: { ...query }, signal, validate: isPeriodPage(isVerification) });
    },
    /** Los conteos del periodo (tarjetas de la pantalla) con los mismos filtros del listado. */
    summary(filters: VerificationFilters, signal?: AbortSignal): Promise<VerificationSummary> {
      return apiRequest<VerificationSummary>(`${base}/summary`, { query: { ...filters }, signal, validate: isSummary });
    },
    /** Un intento con todo lo que se midió. 404 si no existe o es de otra empresa. */
    detail(id: number, signal?: AbortSignal): Promise<VerificationDetail> {
      return apiRequest<VerificationDetail>(`${base}/${id}`, { signal, validate: isDetail });
    },
  };
}

/** Verificaciones de la empresa de la sesión (pantalla «Verificaciones»: mapa, tabla, resumen y detalle). */
export const verificationsService = historyService(verificationsBase.company);

/** Historial de TODAS las empresas (pantalla del ADMIN): el mismo contrato, con la empresa de cada fila. */
export const adminVerificationsService = {
  ...historyService(verificationsBase.admin),
  list(query: CompanyVerificationQuery & VerificationFilters, signal?: AbortSignal): Promise<VerificationHistoryList> {
    return apiRequest<VerificationHistoryList>(verificationsBase.admin, { query: { ...query }, signal, validate: isPeriodPage(isRow) });
  },
};
