import type { PageQuery } from '../types';
import type { CompanyDriftPage, DriftPage, DriftPlatform, DriftStatus, DriftSummary } from '../types/drift';
import { hasKeys, isPage } from '../utils/guards';
import { apiEnvelope, apiRequest } from './apiClient';

const BASE = '/admin/drift';
const isSummary = hasKeys<DriftSummary>('window_days', 'weeks', 'alerts', 'platforms', 'versions');
const isRow = hasKeys('id', 'week_start', 'signal', 'platform', 'status', 'samples');
const isCompanyRow = hasKeys('id', 'week_start', 'company_id', 'company_name', 'status', 'reviews');

export interface DriftQuery extends PageQuery {
  week?: string;
  platform?: DriftPlatform;
  status?: DriftStatus;
}

/**
 * Deriva de las señales del motor facial (solo el ADMIN, pantalla ADMIN_DRIFT; antifraude fase 3): cada semana el
 * mantenimiento compara, por señal y plataforma, los intentos genuinos de la ventana con la anterior (mediana, cola y
 * PSI) y, por empresa, la tasa de casos y las revisiones aprobadas sin mirar. Aquí solo se lee; «Calcular ahora»
 * repite el cálculo de la última ventana completa (idempotente).
 */
export const driftService = {
  summary(signal?: AbortSignal): Promise<DriftSummary> {
    return apiRequest<DriftSummary>(`${BASE}/summary`, { signal, validate: isSummary });
  },

  signals(query: DriftQuery, signal?: AbortSignal): Promise<DriftPage> {
    return apiRequest<DriftPage>(BASE, { query: { ...query }, signal, validate: isPage<DriftPage>(isRow) });
  },

  companies(query: PageQuery & { week?: string; search?: string }, signal?: AbortSignal): Promise<CompanyDriftPage> {
    return apiRequest<CompanyDriftPage>(`${BASE}/companies`, { query: { ...query }, signal, validate: isPage<CompanyDriftPage>(isCompanyRow) });
  },

  /** Calcula ahora la última ventana completa; devuelve el resumen nuevo y el mensaje del servidor (cuántas filas). */
  async compute(): Promise<{ summary: DriftSummary; message: string }> {
    const { data, message } = await apiEnvelope<DriftSummary>(`${BASE}/compute`, { method: 'POST', validate: isSummary });
    return { summary: data, message };
  },
};
