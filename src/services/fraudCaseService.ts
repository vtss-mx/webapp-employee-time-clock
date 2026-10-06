import type { FraudCaseDecisionInput, FraudCaseDetail, FraudCaseList, FraudCaseQuery, FraudEvidenceImage } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isCase = hasKeys('id', 'company_id', 'status', 'kind', 'reason', 'attempts');
const isDetail = hasKeys<FraudCaseDetail>('id', 'status', 'attempts_detail', 'events', 'evidence_items');
const isImage = hasKeys<FraudEvidenceImage>('id', 'content_type', 'data');

/**
 * Casos de fraude (solo el ADMIN de la plataforma): la bandeja, el detalle con sus intentos y su historial, la
 * revisión (tomar, confirmar, descartar o dejar no concluyente) y los fotogramas de evidencia, que llegan por la
 * API (nunca una URL del bucket) y cuya consulta queda en el historial del caso.
 */
export const fraudCaseService = {
  /** Sin `status`, los que esperan revisión (abiertos y en revisión); `ALL` = todos. */
  list(query: FraudCaseQuery, signal?: AbortSignal): Promise<FraudCaseList> {
    return apiRequest<FraudCaseList>('/admin/fraud-cases', { query: { ...query }, signal, validate: isPage(isCase) });
  },

  /** Casos por revisar (contador del menú). */
  count(signal?: AbortSignal): Promise<number> {
    return apiRequest<{ active: number }>('/admin/fraud-cases/count', { signal, validate: hasKeys<{ active: number }>('active') }).then((result) => result.active);
  },

  get(id: number, signal?: AbortSignal): Promise<FraudCaseDetail> {
    return apiRequest<FraudCaseDetail>(`/admin/fraud-cases/${id}`, { signal, validate: isDetail });
  },

  /** Confirmar o descartar exigen la nota (el backend responde 422 `FRAUD_NOTE_REQUIRED` sin ella). */
  decide(id: number, decision: FraudCaseDecisionInput): Promise<FraudCaseDetail> {
    const note = decision.note?.trim() || null;
    return apiRequest<FraudCaseDetail>(`/admin/fraud-cases/${id}/decision`, { method: 'POST', body: { status: decision.status, note }, validate: isDetail });
  },

  addNote(id: number, note: string): Promise<FraudCaseDetail> {
    return apiRequest<FraudCaseDetail>(`/admin/fraud-cases/${id}/notes`, { method: 'POST', body: { note: note.trim() }, validate: isDetail });
  },

  /** Un fotograma descifrado (base64): 404 si ya venció, 503 si el bucket no responde. */
  evidence(id: number, evidenceId: number, signal?: AbortSignal): Promise<FraudEvidenceImage> {
    return apiRequest<FraudEvidenceImage>(`/admin/fraud-cases/${id}/evidence/${evidenceId}`, { signal, validate: isImage });
  },
};
