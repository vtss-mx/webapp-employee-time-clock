import type { FeedbackResult, Page, PageQuery, ReportAnswer, ReportCatalog, ReportPlan, SavedReport } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiDownload, apiRequest, type DownloadedFile } from './apiClient';

const isAnswer = hasKeys<ReportAnswer>('answer', 'understood', 'alternatives');
const isSaved = hasKeys<SavedReport>('id', 'name', 'plan');
/** Un Excel grande tarda más en generarse que una consulta normal. */
const EXPORT_TIMEOUT_MS = 120_000;

/**
 * Asistente de reportes de la empresa. El backend interpreta las preguntas, valida cada plan contra
 * su catálogo y consulta solo los datos de la empresa de la sesión.
 */
export const reportService = {
  catalog(signal?: AbortSignal): Promise<ReportCatalog> {
    return apiRequest<ReportCatalog>('/reports/catalog', { signal, validate: hasKeys<ReportCatalog>('datasets', 'suggestions') });
  },

  /** `context`: el plan de la respuesta anterior (para «¿y por departamento?»). */
  ask(question: string, context: ReportPlan | null): Promise<ReportAnswer> {
    return apiRequest<ReportAnswer>('/reports/ask', { method: 'POST', body: { question, context }, validate: isAnswer });
  },

  preview(plan: ReportPlan): Promise<ReportAnswer> {
    return apiRequest<ReportAnswer>('/reports/preview', { method: 'POST', body: { plan }, validate: isAnswer });
  },

  exportExcel(plan: ReportPlan, queryId: number | null, question: string | null): Promise<DownloadedFile> {
    return apiDownload('/reports/export', { method: 'POST', body: { plan, query_id: queryId, question }, timeoutMs: EXPORT_TIMEOUT_MS });
  },

  /** ¿Sirvió? / ¿a qué datos te referías? (el asistente aprende de la empresa). */
  feedback(queryId: number, choice: { helpful?: boolean; dataset?: string }): Promise<FeedbackResult> {
    return apiRequest<FeedbackResult>('/reports/feedback', { method: 'POST', body: { query_id: queryId, ...choice }, validate: hasKeys<FeedbackResult>('learned') });
  },

  saved(query: PageQuery, signal?: AbortSignal): Promise<Page<SavedReport>> {
    return apiRequest<Page<SavedReport>>('/reports/saved', { query: { ...query }, signal, validate: isPage(isSaved) });
  },

  save(name: string, plan: ReportPlan, question: string | null, queryId: number | null): Promise<SavedReport> {
    return apiRequest<SavedReport>('/reports/saved', { method: 'POST', body: { name, plan, question, query_id: queryId }, validate: isSaved });
  },

  runSaved(id: number): Promise<ReportAnswer> {
    return apiRequest<ReportAnswer>(`/reports/saved/${id}/run`, { method: 'POST', validate: isAnswer });
  },

  deleteSaved(id: number): Promise<void> {
    return apiRequest<void>(`/reports/saved/${id}`, { method: 'DELETE' });
  },
};
