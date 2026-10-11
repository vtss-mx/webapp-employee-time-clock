/**
 * Continuidad del servicio (sección de la pantalla `ADMIN_PERFORMANCE`; migración 0097 del backend): contrato de
 * `/api/admin/continuity`.
 *
 * Responde «¿a qué se compromete la plataforma?» (RTO y RPO declarados) y «¿cuándo fue el último ensayo de
 * restauración y cómo salió?». Todo el tiempo llega en segundos o minutos y todo el volumen en MB (regla 17): la
 * app los formatea con `formatDuration`, `formatMinutes` y `formatBytes`.
 */
import type { Page } from './index';

/** Qué se ensayó al restaurar. Un código que esta versión no conozca se dibuja tal cual (es un dato). */
export type RestoreDrillKind = 'PITR' | 'BUCKET_DUMP';

/** Un ensayo de restauración: cuándo, cómo salió y qué se midió. */
export interface RestoreDrill {
  id: number;
  kind: RestoreDrillKind;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  /** null cuando ese ensayo no mide esa cifra (el del `pg_dump` no mide RPO). */
  rto_seconds: number | null;
  rpo_seconds: number | null;
  /** Con cuánto se ensayó, en MB: un RTO sin su volumen no dice nada. */
  dataset_mb: number | null;
  /** Lo comprometido CUANDO se midió (endurecer la meta después no reescribe el pasado). */
  target_rto_minutes: number;
  target_rpo_seconds: number;
  met_targets: boolean;
  actor: string;
  notes: string | null;
  recorded_at: string;
}

export type RestoreDrillPage = Page<RestoreDrill>;

/** El estado de un tipo de ensayo: su último intento, su último éxito y si ya toca repetirlo. */
export interface DrillStatus {
  kind: RestoreDrillKind;
  last_attempt: RestoreDrill | null;
  last_success: RestoreDrill | null;
  /** Días desde el último ensayo EXITOSO; null = nunca hubo uno (y entonces está vencido). */
  days_since_success: number | null;
  overdue: boolean;
  /** Cuándo toca el siguiente; null = nunca se ha ensayado, toca ya. */
  due_on: string | null;
}

/** Compromiso declarado, estado de los respaldos y los ensayos de cada mecanismo. */
export interface Continuity {
  rto_minutes: number;
  rpo_seconds: number;
  drill_interval_days: number;
  /** Lo que de verdad está encendido hoy (un compromiso con los respaldos apagados no vale nada). */
  backup_upload_enabled: boolean;
  pitr_enabled: boolean;
  backup_interval_hours: number;
  backup_retention_days: number;
  pitr_archive_timeout_seconds: number;
  pitr_retention_days: number;
  drills: DrillStatus[];
  /** Cuántos tipos de ensayo están vencidos (el contador que la pantalla muestra como alerta). */
  overdue_count: number;
}
