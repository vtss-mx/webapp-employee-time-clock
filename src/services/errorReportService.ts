import type { ErrorOccurrenceList, ErrorReportDetail, ErrorReportList, ErrorSeverity, ErrorStatus, ErrorSummary, PageQuery, ServerStatus } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isReport = hasKeys<ErrorReportDetail>('id', 'code', 'status', 'severity', 'occurrences');

export interface ErrorReportQuery extends PageQuery {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
  search?: string;
}

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
};
