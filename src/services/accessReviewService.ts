import type { PageQuery } from '../types';
import type { AccessReviewAccount, AccessReviewExport, AccessReviewFilters, AccessReviewList, AccessReviewSummary } from '../types/accessReview';
import { config } from '../utils/config';
import { hasKeys, isPage, isRecord, type Guard } from '../utils/guards';
import { apiRequest } from './apiClient';

const BASE = '/admin/access-review';

const isAccount = hasKeys<AccessReviewAccount>('id', 'email', 'role', 'active', 'created_at');
const isControls = hasKeys('mfa_required_for', 'mfa_grace_days', 'password_min_length', 'stale_days');

const isSummary: Guard<AccessReviewSummary> = (value): value is AccessReviewSummary =>
  hasKeys<AccessReviewSummary>('generated_at', 'accounts', 'by_role', 'stale', 'locked', 'privileged', 'controls')(value) &&
  isRecord(value.by_role) &&
  isControls(value.controls);

const isExport = hasKeys<AccessReviewExport>('filename', 'content_type', 'data', 'rows', 'limit', 'generated_at');

/** Los filtros como los espera la API; los interruptores solo se envían cuando están encendidos. */
function query(filters: AccessReviewFilters): Record<string, string | number | boolean | undefined> {
  return {
    role: filters.role,
    company_id: filters.company_id,
    without_mfa: filters.without_mfa ? true : undefined,
    stale: filters.stale ? true : undefined,
    locked: filters.locked ? true : undefined,
    search: filters.search,
  };
}

/**
 * Revisión de accesos (solo el ADMIN, pantalla `ADMIN_ACCESS_REVIEW`; migración 0096 del backend): todas las
 * cuentas vigentes con su rol, su empresa, su último acceso, su segundo factor, sus sesiones abiertas y sus
 * empleos, más el resumen fechado con los CONTROLES declarados que el servidor toma de su código vigente.
 *
 * Solo lecturas: el informe no cambia nada (dar de baja una cuenta se hace en su módulo). La exportación es un CSV
 * en base64 dentro del contrato único, que la pantalla guarda con `utils/download.ts`.
 */
export const accessReviewService = {
  list(filters: AccessReviewFilters, page: PageQuery, signal?: AbortSignal): Promise<AccessReviewList> {
    return apiRequest<AccessReviewList>(BASE, { query: { ...page, ...query(filters) }, signal, validate: isPage<AccessReviewList>(isAccount) });
  },

  summary(signal?: AbortSignal): Promise<AccessReviewSummary> {
    return apiRequest<AccessReviewSummary>(`${BASE}/summary`, { signal, validate: isSummary });
  },

  /** El informe completo con los MISMOS filtros del listado, acotado por el tope del servidor. */
  export(filters: AccessReviewFilters, signal?: AbortSignal): Promise<AccessReviewExport> {
    return apiRequest<AccessReviewExport>(`${BASE}/export`, { query: query(filters), timeoutMs: config.exportTimeoutMs, signal, validate: isExport });
  },
};
