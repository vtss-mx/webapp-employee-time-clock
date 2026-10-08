/**
 * Datos de personas del backend falso (empleados, jornadas, solicitudes...): nombres y notas son datos que escribió
 * alguien (iguales en los dos idiomas); los textos del sistema dentro de ellos (un motivo guardado, el mensaje
 * de "qué puedo registrar ahora") van en el idioma de la petición.
 */
import type { Absence, AttendanceToday, CompanySessionDetail, Employee, EmployeeRef, Holiday, ShiftRequest, WorkSession, Workday } from '../../types';
import { morning, plantRef, weekend } from '../shifts';
import { say, tx, type Ctx } from './core';

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
  department_id: 1,
  department_name: 'Operaciones Acme',
  // Sin foto de perfil: la pantalla dibuja las iniciales (el backend manda `avatar` en cada persona).
  avatar: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...extra,
});

export const ref: EmployeeRef = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', avatar: null };

export const session: WorkSession = {
  id: 1,
  work_date: '2026-10-05',
  shift_name: 'Turno Acme',
  scheduled_start: '2026-10-05T14:00:00Z',
  scheduled_end: '2026-10-05T22:00:00Z',
  check_out_deadline: '2026-10-05T23:00:00Z',
  status: 'CLOSED',
  check_in_at: '2026-10-05T14:05:00Z',
  check_in_mode: 'ON_SITE',
  check_in_site: 'Sitio Acme',
  check_out_at: '2026-10-05T22:00:00Z',
  check_out_mode: 'ON_SITE',
  check_out_site: 'Sitio Acme',
  late_minutes: 5,
  early_leave_minutes: 0,
  break_minutes: 30,
  worked_minutes: 445,
  breaks_allowed: 1,
  break_minutes_allowed: 30,
  breaks: [{ started_at: '2026-10-05T18:00:00Z', ended_at: '2026-10-05T18:30:00Z', minutes: 30, exceeded_minutes: 0 }],
  review_status: 'PENDING',
  review_reasons: ['OUTSIDE_GEOFENCE'],
};

export const sessionDetail: CompanySessionDetail = {
  ...session,
  employee: ref,
  events: [
    { action: 'CHECK_IN', mode: 'ON_SITE', site: 'Sitio Acme', occurred_at: '2026-10-05T14:05:00Z', latitude: 29.07, longitude: -110.95, accuracy_m: 12, distance_m: 30, confidence: 0.99, operator: null, under_review: true },
    { action: 'CHECK_OUT', mode: 'ON_SITE', site: 'Sitio Acme', occurred_at: '2026-10-05T22:00:00Z', latitude: 29.07, longitude: -110.95, accuracy_m: 10, distance_m: 20, confidence: 0.99, operator: null },
  ],
};

export const shiftRequest: ShiftRequest = {
  id: 1,
  employee: ref,
  shift: weekend,
  current_shift: morning,
  valid_from: '2030-01-07',
  reason: 'Clases Acme',
  status: 'PENDING',
  review_note: null,
  reviewed_at: null,
  created_at: '2026-10-05T10:00:00Z',
};

export const holidays = (ctx: Ctx): Holiday[] => [
  { id: 1, holiday_date: '2026-12-25', name: tx(ctx, say({ 'es-MX': 'Navidad', 'en-US': 'Christmas Day', 'pt-BR': 'Natal', 'fr-FR': 'Noël', 'de-DE': 'Weihnachten', 'it-IT': 'Natale', 'es-ES': 'Navidad' })), official: true, created_at: '2026-01-02T10:00:00Z' },
  { id: 2, holiday_date: '2026-10-20', name: 'Aniversario Acme', official: false, created_at: '2026-01-02T10:00:00Z' },
];

export const absence: Absence = {
  id: 1,
  employee: ref,
  type: 'VACATION',
  starts_on: '2026-10-20',
  ends_on: '2026-10-22',
  days: 3,
  note: 'Viaje Acme',
  status: 'PENDING',
  requested_by_employee: true,
  decided_at: null,
  decision_note: null,
  created_at: '2026-10-05T10:00:00Z',
};

export const workday: Workday = { id: 1, employee: ref, work_date: '2026-10-25', note: 'Guardia Acme', created_at: '2026-10-01T10:00:00Z' };

/** "Qué puedo registrar ahora": el mensaje lo arma el backend en el idioma de la petición. */
export const today = (ctx: Ctx): AttendanceToday => ({
  now: '2026-10-06T15:00:00Z',
  shift: morning,
  occurrence: { work_date: '2026-10-06', start: '2026-10-06T14:00:00Z', end: '2026-10-06T22:00:00Z', opens: '2026-10-06T13:45:00Z', deadline: '2026-10-06T23:00:00Z' },
  next_occurrence: { work_date: '2026-10-07', start: '2026-10-07T14:00:00Z', end: '2026-10-07T22:00:00Z', opens: '2026-10-07T13:45:00Z', deadline: '2026-10-07T23:00:00Z' },
  session: { ...session, status: 'OPEN', check_out_at: null, check_out_mode: null, check_out_site: null, worked_minutes: null, breaks: [] },
  actions: ['BREAK_START', 'CHECK_OUT'],
  remote_allowed: false,
  sites: [plantRef],
  site_code: false,
  message: tx(ctx, say({ 'es-MX': 'Ya registraste tu entrada. Puedes salir a tu descanso o registrar tu salida.', 'en-US': 'You already checked in. You can start your break or check out.', 'pt-BR': 'Você já registrou a entrada. Pode sair para o intervalo ou registrar a saída.', 'fr-FR': 'Vous avez déjà pointé votre arrivée. Vous pouvez partir en pause ou pointer votre départ.', 'de-DE': 'Sie haben Ihr Kommen bereits gebucht. Sie können in die Pause gehen oder Ihr Gehen buchen.', 'it-IT': "Hai già timbrato l'entrata. Puoi uscire per la pausa o timbrare l'uscita.", 'es-ES': 'Ya has fichado la entrada. Puedes salir a tu descanso o fichar la salida.' })),
  day_off: null,
  break_window: { starts_at: '2026-10-06T18:00:00Z', ends_at: '2026-10-06T19:00:00Z', minutes: 30, remaining: 30 },
});
