import type { PageQuery } from '../types';
import type { AuditEvent, AuditEventList, AuditExport, AuditFilters, AuditSummary } from '../types/audit';
import { config } from '../utils/config';
import { hasKeys, isArrayOf, isPage, type Guard } from '../utils/guards';
import { apiRequest } from './apiClient';

const BASE = '/admin/audit';

const isEvent = hasKeys<AuditEvent>('id', 'occurred_at', 'action', 'outcome');
const isCount = hasKeys('action', 'outcome', 'total');
const hasPeriod = hasKeys('since', 'until');

/** Página de la bitácora: los eventos y el periodo que de verdad se consultó (la pantalla lo muestra). */
const isList: Guard<AuditEventList> = (value): value is AuditEventList => isPage<AuditEventList>(isEvent)(value) && hasPeriod(value);

const isSummary: Guard<AuditSummary> = (value): value is AuditSummary =>
  hasKeys<AuditSummary>('total', 'dropped', 'pending', 'retention_days')(value) && hasPeriod(value) && isArrayOf(isCount)(value.by_action);

/** Un tramo de la exportación: sus eventos y el cursor del siguiente (vacío = ya no hay más). */
const isExport: Guard<AuditExport> = (value): value is AuditExport =>
  hasKeys<AuditExport>('items', 'next_cursor')(value) && hasPeriod(value) && isArrayOf(isEvent)(value.items);

/** Los filtros como los espera la API: lo vacío no se envía (`buildUrl` lo omite). */
function query(filters: AuditFilters): Record<string, string | number | undefined> {
  return {
    since: filters.since,
    until: filters.until,
    actor_email: filters.actor_email,
    action: filters.action,
    outcome: filters.outcome,
    company_id: filters.company_id,
    entity_type: filters.entity_type,
    entity_id: filters.entity_id,
    search: filters.search,
  };
}

/**
 * Bitácora de auditoría (solo el ADMIN, pantalla `ADMIN_AUDIT`; migración 0095 del backend): quién hizo qué, sobre
 * qué y desde dónde, aunque la acción saliera bien, más los accesos NEGADOS que pide una auditoría de accesos.
 *
 * Es EVIDENCIA: solo hay lecturas (ninguna ruta crea, cambia ni borra un evento, así que la app no tiene ni
 * confirmaciones de escritura). La exportación va por CURSOR y no por página, así que bajar un año cuesta lo mismo
 * en el primer tramo que en el último; usa el tiempo límite de las lecturas que exportan.
 */
export const auditService = {
  list(filters: AuditFilters, page: PageQuery, signal?: AbortSignal): Promise<AuditEventList> {
    return apiRequest<AuditEventList>(BASE, { query: { ...page, ...query(filters) }, signal, validate: isList });
  },

  summary(filters: AuditFilters, signal?: AbortSignal): Promise<AuditSummary> {
    return apiRequest<AuditSummary>(`${BASE}/summary`, { query: query(filters), signal, validate: isSummary });
  },

  /** Un tramo del periodo filtrado; `cursor` vacío pide el primero. */
  exportChunk(filters: AuditFilters, cursor: string | null, signal?: AbortSignal): Promise<AuditExport> {
    return apiRequest<AuditExport>(`${BASE}/export`, {
      query: { ...query(filters), cursor: cursor ?? undefined },
      timeoutMs: config.exportTimeoutMs,
      signal,
      validate: isExport,
    });
  },
};
