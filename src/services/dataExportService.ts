import type { DataExport } from '../types/dataExport';
import { config } from '../utils/config';
import { hasKeys, isArrayOf, type Guard } from '../utils/guards';
import { apiEnvelope } from './apiClient';

const isSection = hasKeys('name', 'source', 'rows', 'truncated');
const isWithheld = hasKeys('source', 'reason');
const isRetention = hasKeys('biometrics_days', 'attendance_metadata_days', 'verification_log_days', 'deleted_records_days');

const isExport: Guard<DataExport> = (value): value is DataExport =>
  hasKeys<DataExport>('generated_at', 'scope', 'subject_email', 'company_id', 'company_name', 'next_export_at', 'row_count', 'truncated')(value) &&
  isArrayOf(isSection)(value.sections) &&
  isArrayOf(isWithheld)(value.withheld) &&
  isRetention(value.retention);

/** Lo que la pantalla necesita de una entrega: el expediente y el mensaje del servidor (el aviso). */
export interface DataExportResult {
  data: DataExport;
  message: string;
}

/**
 * Exportación de los datos de una persona (RGPD arts. 15 y 20, derechos ARCO, CCPA; migración 0097 del backend):
 * la pide el TITULAR desde «Mi perfil» (`GET /me/export`, pantalla `PROFILE`) o SU empresa desde el expediente del
 * empleado (`GET /employees/{id}/export`, pantalla `COMPANY_EMPLOYEES`).
 *
 * El ADMIN de la plataforma NO tiene esta ruta para nadie: una cuenta sin empresa en la sesión recibe 403
 * `COMPANY_REQUIRED` (su expediente es su cuenta, que ya ve en «Mi perfil»).
 *
 * Son lecturas pesadas y acotadas a una por titular cada tantas horas (429 `EXPORT_TOO_SOON` con `Retry-After`):
 * por eso NO se reintentan solas (`retries: 0`; un reintento automático solo gastaría el límite) y usan el tiempo
 * límite de las lecturas que exportan. El JSON se guarda con `utils/download.ts`.
 */
export const dataExportService = {
  async mine(signal?: AbortSignal): Promise<DataExportResult> {
    const { data, message } = await apiEnvelope<DataExport>('/me/export', { timeoutMs: config.exportTimeoutMs, retries: 0, signal, validate: isExport });
    return { data, message };
  },

  async employee(employeeId: number, signal?: AbortSignal): Promise<DataExportResult> {
    const { data, message } = await apiEnvelope<DataExport>(`/employees/${employeeId}/export`, {
      timeoutMs: config.exportTimeoutMs,
      retries: 0,
      signal,
      validate: isExport,
    });
    return { data, message };
  },
};
