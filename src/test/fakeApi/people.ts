/**
 * Datos de personas del backend falso (empleados, referencias): nombres y notas son datos que escribió alguien
 * (iguales en todos los idiomas); los textos del sistema dentro de ellos van en el idioma de la petición.
 */
import type { Employee, EmployeeRef } from '../../types';
import type { DataExport, DataExportScope } from '../../types/dataExport';

/** Un empleado completo (la ficha que envía el backend). */
export const person = (id: number, extra: Partial<Employee> = {}): Employee => ({
  id,
  user_id: 100 + id,
  employee_number: `EMP-${id}`,
  first_name: 'Ana',
  last_name: 'Ruiz',
  full_name: 'Ana Ruiz',
  birth_date: '1990-01-01',
  rfc: 'RUAA900101AB1',
  curp: 'RUAA900101MSRRZL09',
  nss: '12345678903',
  phone: '+526621234567',
  email: 'ana@acme.mx',
  active: true,
  headwear_exempt: false,
  face_status: 'APPROVED',
  face_rejection_reason: null,
  latest_enrollment_id: 3,
  has_face: true,
  face_samples: 5,
  // Sin foto de perfil: la pantalla dibuja las iniciales (el backend manda `avatar` en cada persona).
  avatar: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...extra,
});

export const ref: EmployeeRef = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', avatar: null };

/**
 * Exportación de los datos de una persona (migración 0097): las secciones y los motivos de lo retenido llegan como
 * CÓDIGOS (la app los nombra en cada idioma), así que nada de aquí cambia con el idioma de la petición.
 */
export const dataExport = (scope: DataExportScope): DataExport => ({
  generated_at: '2026-10-06T15:00:00Z',
  scope,
  subject_email: 'ana@acme.mx',
  subject_employee_id: 7,
  company_id: 1,
  company_name: 'Acme',
  previous_export_at: null,
  next_export_at: '2026-10-07T15:00:00Z',
  sections: [
    { name: 'account', source: 'auth.users', rows: [{ id: 107, email: 'ana@acme.mx' }], truncated: false },
    { name: 'verification_log', source: 'biometrics.verification_logs', rows: [{ id: 1, method: 'FACE' }], truncated: true },
  ],
  withheld: [
    { source: 'biometrics.capture_traces', reason: 'BIOMETRIC' },
    { source: 'ops.fraud_cases', reason: 'SECURITY' },
  ],
  retention: { biometrics_days: 1095, attendance_metadata_days: 180, verification_log_days: 365, deleted_records_days: 365 },
  row_count: 2,
  truncated: true,
});

