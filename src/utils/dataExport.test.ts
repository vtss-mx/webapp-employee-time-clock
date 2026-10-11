import { describe, expect, it } from 'vitest';
import type { DataExport, ExportSection } from '../types/dataExport';
import { deliveredText, exportFileName, exportJson, nextExportText, retentionRows, sectionName, sectionSummary, truncatedSections, withheldReasonText } from './dataExport';

const section = (over: Partial<ExportSection> = {}): ExportSection => ({ name: 'account', source: 'auth.users', rows: [{ id: 1 }], truncated: false, ...over });

const data = (over: Partial<DataExport> = {}): DataExport => ({
  generated_at: '2026-10-06T15:00:00Z',
  scope: 'SELF',
  subject_email: 'ana@acme.mx',
  subject_employee_id: 7,
  company_id: 1,
  company_name: 'Acme',
  previous_export_at: null,
  next_export_at: '2026-10-07T15:00:00Z',
  sections: [section(), section({ name: 'verification_log', source: 'biometrics.verification_logs', truncated: true })],
  withheld: [{ source: 'biometrics.capture_traces', reason: 'BIOMETRIC' }],
  retention: { biometrics_days: 1095, attendance_metadata_days: 180, verification_log_days: 365, deleted_records_days: 365 },
  row_count: 2,
  truncated: true,
  ...over,
});

describe('reglas puras de la exportación de los datos de una persona', () => {
  it('cada sección se nombra en el idioma de la persona; una que esta versión no conoce, con su llave', () => {
    expect(sectionName(section())).toBe('Cuenta');
    expect(sectionName(section({ name: 'identity_documents' }))).toBe('Documentos de identidad');
    expect(sectionName(section({ name: 'seccion_del_futuro' }))).toBe('seccion_del_futuro');
  });

  it('lo retenido se declara SIEMPRE con su motivo; uno desconocido lleva el texto genérico con su código', () => {
    expect(withheldReasonText({ source: 'x', reason: 'BIOMETRIC' })).toContain('Dato biométrico');
    expect(withheldReasonText({ source: 'x', reason: 'SECURITY' })).toContain('evadir');
    expect(withheldReasonText({ source: 'x', reason: 'OTHER_PEOPLE' })).toContain('otras personas');
    expect(withheldReasonText({ source: 'x', reason: 'TECHNICAL' })).toContain('Dato técnico');
    // @ts-expect-error motivo de un backend más nuevo: se declara con su código, nunca se oculta.
    expect(withheldReasonText({ source: 'x', reason: 'MOTIVO_NUEVO' })).toBe('No se entrega (MOTIVO_NUEVO).');
  });

  it('el nombre del archivo lleva el correo del titular limpio y la fecha de la entrega', () => {
    expect(exportFileName(data())).toBe('datos-ana@acme.mx-2026-10-06.json');
    expect(exportFileName(data({ subject_email: 'ana ruiz/+1@acme.mx' }))).toBe('datos-ana-ruiz--1@acme.mx-2026-10-06.json');
  });

  it('lo entregado, lo cortado y cuándo se podrá pedir de nuevo', () => {
    expect(deliveredText(data())).toBe('2 registros · 2 secciones');
    expect(deliveredText(data({ row_count: 1, sections: [section()] }))).toBe('1 registro · 1 sección');
    expect(deliveredText(data({ row_count: 0, sections: [] }))).toContain('Sin registros');
    expect(truncatedSections(data())).toEqual(['Identificaciones']);
    expect(truncatedSections(data({ sections: [section()] }))).toEqual([]);
    expect(nextExportText(data())).toContain('Podrás pedirla de nuevo a partir del');
  });

  it('cada sección dice cuántas filas llevó y si quedó cortada', () => {
    expect(sectionSummary(section())).toBe('1 registro');
    expect(sectionSummary(section({ rows: [] }))).toBe('Sin registros');
    expect(sectionSummary(section({ rows: [{ a: 1 }, { a: 2 }], truncated: true }))).toBe('2 registros · cortada por el tope');
  });

  it('los plazos de retención se declaran (art. 15.1.d: hay que decirlos)', () => {
    const rows = retentionRows(data());
    expect(rows.map((row) => row.key)).toEqual(['biometrics', 'verificationMetadata', 'verificationLog', 'deletedRecords']);
    expect(rows[0].value).toBe('1,095 días');
    expect(retentionRows(data({ retention: { ...data().retention, biometrics_days: 1 } }))[0].value).toBe('1 día');
  });

  it('el archivo es legible por una máquina y por una persona (JSON con sangría)', () => {
    const json = exportJson(data());
    expect(JSON.parse(json)).toEqual(data());
    expect(json).toContain('\n  "scope": "SELF"');
  });
});
