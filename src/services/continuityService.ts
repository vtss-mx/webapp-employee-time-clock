import type { PageQuery } from '../types';
import type { Continuity, DrillStatus, RestoreDrill, RestoreDrillKind, RestoreDrillPage } from '../types/continuity';
import { hasKeys, isArrayOf, isPage, type Guard } from '../utils/guards';
import { apiRequest } from './apiClient';

const BASE = '/admin/continuity';

const isDrill = hasKeys<RestoreDrill>('id', 'kind', 'started_at', 'success', 'target_rto_minutes', 'target_rpo_seconds', 'met_targets');
const isStatus = hasKeys<DrillStatus>('kind', 'overdue');

const isContinuity: Guard<Continuity> = (value): value is Continuity =>
  hasKeys<Continuity>('rto_minutes', 'rpo_seconds', 'drill_interval_days', 'backup_upload_enabled', 'pitr_enabled', 'overdue_count')(value) &&
  isArrayOf(isStatus)(value.drills);

/**
 * Continuidad del servicio (solo el ADMIN; reutiliza la pantalla `ADMIN_PERFORMANCE`, como lo hizo el backend a
 * propósito para no tocar el contrato de pantallas): el compromiso declarado de recuperación (RTO y RPO) y los
 * ensayos de restauración que lo demuestran, con su resultado y lo medido.
 *
 * Solo lecturas: **nada se escribe desde la API**. Un ensayo lo registra el proceso que de verdad restauró; no
 * existe un endpoint para declararlo a mano, así que la app no ofrece ningún botón para «marcar» un ensayo.
 */
export const continuityService = {
  overview(signal?: AbortSignal): Promise<Continuity> {
    return apiRequest<Continuity>(BASE, { signal, validate: isContinuity });
  },

  /** Historial de ensayos, lo más reciente primero (los fallidos también: son los que hay que ver). */
  drills(query: PageQuery & { kind?: RestoreDrillKind }, signal?: AbortSignal): Promise<RestoreDrillPage> {
    return apiRequest<RestoreDrillPage>(`${BASE}/drills`, { query: { ...query }, signal, validate: isPage<RestoreDrillPage>(isDrill) });
  },
};
