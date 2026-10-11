/**
 * Reglas puras de la continuidad del servicio (sección «Continuidad» de la pantalla «Rendimiento»): el estado de
 * cada tipo de ensayo y lo que se midió. Sin React ni peticiones.
 *
 * **Nunca ensayado = vencido** (lo decide el SERVIDOR: `overdue` llega en la respuesta y `days_since_success` es
 * null). La app solo lo dibuja; no calcula ningún plazo.
 */
import { t } from '../i18n';
import type { Continuity, DrillStatus, RestoreDrill } from '../types/continuity';
import type { StatusTone } from '../types/index';
import { formatDate, formatDateTime } from './format';
import { formatBytes, formatDuration, BYTES_PER_MB } from './numbers';

/** En qué está un tipo de ensayo: nunca se hizo, está vencido, el último falló o todo al día. */
export type DrillState = 'never' | 'overdue' | 'failed' | 'ok';

export const DRILL_TONE: Record<DrillState, StatusTone> = {
  never: 'danger',
  overdue: 'danger',
  failed: 'warning',
  ok: 'success',
};

/**
 * El estado de un tipo de ensayo. «Nunca ensayado» se muestra aparte de «vencido» aunque el servidor cuente los
 * dos como vencidos: no es lo mismo que se pasó la fecha y que nunca se ha probado restaurar.
 */
export function drillState(status: DrillStatus): DrillState {
  if (status.last_success === null) return status.last_attempt === null ? 'never' : 'failed';
  if (status.overdue) return 'overdue';
  return status.last_attempt && !status.last_attempt.success ? 'failed' : 'ok';
}

/** Cuándo fue el último ensayo exitoso y cuándo toca el siguiente (o que nunca se ha ensayado). */
export function drillWhen(status: DrillStatus): string {
  if (status.last_success === null) return t('continuity.neverDrilled');
  const last = t('continuity.lastSuccess', { date: formatDateTime(status.last_success.finished_at ?? status.last_success.started_at) });
  const next = status.due_on ? t('continuity.dueOn', { date: formatDate(status.due_on) }) : t('continuity.dueNow');
  return `${last} · ${next}`;
}

/** Lo que midió un ensayo: RTO, RPO y con cuánto se hizo. Lo que no se midió no se inventa. */
export function drillMeasures(drill: RestoreDrill): string[] {
  const parts: string[] = [];
  if (drill.rto_seconds !== null) parts.push(t('continuity.rtoMeasured', { value: formatDuration(drill.rto_seconds * 1000) }));
  if (drill.rpo_seconds !== null) parts.push(t('continuity.rpoMeasured', { value: formatDuration(drill.rpo_seconds * 1000) }));
  if (drill.dataset_mb !== null) parts.push(t('continuity.dataset', { value: formatBytes(drill.dataset_mb * BYTES_PER_MB) }));
  return parts;
}

/** El compromiso con que se midió ESE ensayo (endurecer la meta después no vuelve incumplimiento lo que cumplía). */
export function drillTargets(drill: RestoreDrill): string {
  return t('continuity.targetsAt', {
    rto: formatDuration(drill.target_rto_minutes * 60_000),
    rpo: formatDuration(drill.target_rpo_seconds * 1000),
  });
}

/** Una fila del compromiso declarado: su etiqueta y su valor. */
export interface CommitmentRow {
  key: string;
  label: string;
  value: string;
}

/**
 * El compromiso declarado y lo que de verdad está encendido hoy: un RTO y un RPO con los respaldos apagados no
 * valen nada, así que los dos interruptores se muestran junto a las metas.
 */
export function commitmentRows(data: Continuity): CommitmentRow[] {
  const switchText = (value: boolean) => t(value ? 'continuity.enabled' : 'continuity.disabled');
  return [
    { key: 'rto', label: t('continuity.rto'), value: formatDuration(data.rto_minutes * 60_000) },
    { key: 'rpo', label: t('continuity.rpo'), value: formatDuration(data.rpo_seconds * 1000) },
    { key: 'interval', label: t('continuity.interval'), value: t('continuity.days', { count: data.drill_interval_days }) },
    { key: 'backupUpload', label: t('continuity.backupUpload'), value: switchText(data.backup_upload_enabled) },
    { key: 'pitr', label: t('continuity.pitr'), value: switchText(data.pitr_enabled) },
    { key: 'backupInterval', label: t('continuity.backupInterval'), value: formatDuration(data.backup_interval_hours * 3_600_000) },
    { key: 'backupRetention', label: t('continuity.backupRetention'), value: t('continuity.days', { count: data.backup_retention_days }) },
    { key: 'pitrArchive', label: t('continuity.pitrArchive'), value: formatDuration(data.pitr_archive_timeout_seconds * 1000) },
    { key: 'pitrRetention', label: t('continuity.pitrRetention'), value: t('continuity.days', { count: data.pitr_retention_days }) },
  ];
}

/**
 * ¿El compromiso de RPO es creíble? Nunca puede ser menor que cada cuánto se archiva el WAL: si lo fuera, la meta
 * no se puede cumplir ni con todo funcionando, y la pantalla lo advierte en lugar de mostrar un número bonito.
 */
export function rpoUnreachable(data: Continuity): boolean {
  return data.pitr_enabled && data.rpo_seconds < data.pitr_archive_timeout_seconds;
}
