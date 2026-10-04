import type { ErrorOccurrenceList, ErrorReportDetail, ErrorReportList, ErrorSeverity, ErrorStatus, ErrorSummary, PageQuery, ServerStatus } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isReport = hasKeys<ErrorReportDetail>('id', 'code', 'status', 'severity', 'occurrences');

/** Filtro de la bandeja (el mismo al listar y al marcar en bloque). */
export interface ErrorFilter {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
  search?: string;
}

export interface ErrorReportQuery extends PageQuery, ErrorFilter {}

/** Errores del sistema (solo el ADMIN de la plataforma): bandeja, detalle y seguimiento. */
export const errorReportService = {
  list(query: ErrorReportQuery, signal?: AbortSignal): Promise<ErrorReportList> {
    return apiRequest<ErrorReportList>('/admin/errors', { query: { ...query }, signal, validate: isPage(isReport) });
  },

  summary(signal?: AbortSignal): Promise<ErrorSummary> {
    return apiRequest<ErrorSummary>('/admin/errors/summary', { signal, validate: hasKeys<ErrorSummary>('by_status', 'pending') });
  },

  get(id: number, signal?: AbortSignal): Promise<ErrorReportDetail> {
    return apiRequest<ErrorReportDetail>(`/admin/errors/${id}`, { signal, validate: isReport });
  },

  occurrences(id: number, query: PageQuery, signal?: AbortSignal): Promise<ErrorOccurrenceList> {
    return apiRequest<ErrorOccurrenceList>(`/admin/errors/${id}/occurrences`, { query: { ...query }, signal, validate: isPage(hasKeys('id', 'occurred_at')) });
  },

  /** Dependencias con su detalle y la capacidad adaptativa del proceso que responde. */
  server(signal?: AbortSignal): Promise<ServerStatus> {
    return apiRequest<ServerStatus>('/admin/errors/server', { signal, validate: hasKeys<ServerStatus>('status', 'components', 'admission') });
  },

  setStatus(id: number, status: ErrorStatus): Promise<ErrorReportDetail> {
    return apiRequest<ErrorReportDetail>(`/admin/errors/${id}/status`, { method: 'PATCH', body: { status }, validate: isReport });
  },

  /**
   * Marca como solucionados todos los errores abiertos del filtro (estado o gravedad específicos; el
   * backend lo exige). `seenUntil` es el `as_of` de la lista que vio el ADMIN: lo que ocurrió después
   * sigue abierto. Devuelve cuántos cambiaron.
   */
  resolveMatching(filter: ErrorFilter, seenUntil: string): Promise<number> {
    return apiRequest<{ resolved: number }>('/admin/errors/resolve', {
      method: 'POST',
      body: { ...filter, seen_until: seenUntil },
      validate: hasKeys<{ resolved: number }>('resolved'),
    }).then((result) => result.resolved);
  },
};
