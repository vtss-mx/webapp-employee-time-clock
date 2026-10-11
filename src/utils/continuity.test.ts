import { describe, expect, it } from 'vitest';
import type { Continuity, DrillStatus, RestoreDrill } from '../types/continuity';
import { DRILL_TONE, commitmentRows, drillMeasures, drillState, drillTargets, drillWhen, rpoUnreachable } from './continuity';

const drill = (over: Partial<RestoreDrill> = {}): RestoreDrill => ({
  id: 1,
  kind: 'PITR',
  started_at: '2026-10-01T02:00:00Z',
  finished_at: '2026-10-01T02:12:00Z',
  success: true,
  rto_seconds: 720,
  rpo_seconds: 45,
  dataset_mb: 2048,
  target_rto_minutes: 30,
  target_rpo_seconds: 60,
  met_targets: true,
  actor: 'scripts/db_pitr_check.sh',
  notes: null,
  recorded_at: '2026-10-01T02:12:30Z',
  ...over,
});

const status = (over: Partial<DrillStatus> = {}): DrillStatus => ({
  kind: 'PITR',
  last_attempt: drill(),
  last_success: drill(),
  days_since_success: 4,
  overdue: false,
  due_on: '2026-12-30T02:00:00Z',
  ...over,
});

const continuity: Continuity = {
  rto_minutes: 30,
  rpo_seconds: 60,
  drill_interval_days: 90,
  backup_upload_enabled: true,
  pitr_enabled: true,
  backup_interval_hours: 24,
  backup_retention_days: 30,
  pitr_archive_timeout_seconds: 60,
  pitr_retention_days: 14,
  drills: [status()],
  overdue_count: 0,
};

describe('reglas puras de la continuidad del servicio', () => {
  it('nunca ensayado, vencido, el último falló o al día (y su tono)', () => {
    expect(drillState(status({ last_attempt: null, last_success: null }))).toBe('never');
    expect(drillState(status({ last_success: null, last_attempt: drill({ success: false }) }))).toBe('failed');
    expect(drillState(status({ overdue: true }))).toBe('overdue');
    expect(drillState(status({ last_attempt: drill({ id: 2, success: false }) }))).toBe('failed');
    expect(drillState(status())).toBe('ok');
    expect(DRILL_TONE.never).toBe('danger');
    expect(DRILL_TONE.ok).toBe('success');
  });

  it('cuándo fue el último ensayo y cuándo toca el siguiente; nunca ensayado lo dice', () => {
    expect(drillWhen(status({ last_success: null }))).toBe('Nunca se ha ensayado: toca hacerlo.');
    expect(drillWhen(status())).toContain('Último ensayo correcto:');
    expect(drillWhen(status())).toContain('siguiente el');
    expect(drillWhen(status({ due_on: null }))).toContain('toca ahora');
    // Sin hora de fin se usa la de inicio (un ensayo que no terminó de registrarse).
    expect(drillWhen(status({ last_success: drill({ finished_at: null }) }))).toContain('Último ensayo correcto:');
  });

  it('solo lo que se midió: lo que el ensayo no mide no se inventa', () => {
    expect(drillMeasures(drill())).toEqual(['Volvió en 12 min', 'Se perdieron 45 s', 'Con 2,048.00 MB']);
    expect(drillMeasures(drill({ rto_seconds: null, rpo_seconds: null, dataset_mb: null }))).toEqual([]);
  });

  it('el compromiso con que se midió ESE ensayo', () => {
    expect(drillTargets(drill())).toBe('Comprometido entonces: 30 min y 1 min');
  });

  it('el compromiso declarado y lo que está encendido hoy, en filas legibles', () => {
    const rows = commitmentRows(continuity);
    expect(rows.map((row) => row.key)).toEqual(['rto', 'rpo', 'interval', 'backupUpload', 'pitr', 'backupInterval', 'backupRetention', 'pitrArchive', 'pitrRetention']);
    expect(rows[0]).toEqual({ key: 'rto', label: 'Tiempo máximo para volver (RTO)', value: '30 min' });
    expect(rows[2].value).toBe('90 días');
    expect(rows[3].value).toBe('Encendida');
    expect(commitmentRows({ ...continuity, backup_upload_enabled: false, drill_interval_days: 1 })[3].value).toBe('Apagada');
    expect(commitmentRows({ ...continuity, drill_interval_days: 1 })[2].value).toBe('1 día');
  });

  it('un RPO menor que el archivo del WAL no se puede cumplir y se advierte (solo con PITR encendida)', () => {
    expect(rpoUnreachable(continuity)).toBe(false);
    expect(rpoUnreachable({ ...continuity, rpo_seconds: 30 })).toBe(true);
    expect(rpoUnreachable({ ...continuity, rpo_seconds: 30, pitr_enabled: false })).toBe(false);
  });
});
