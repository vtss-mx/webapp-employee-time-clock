import { siteAddress } from '../../../test/shifts';
import type { Absence, AttendanceActionResult, AttendanceToday, BreakWindow, DayOff, Holiday, Occurrence, Shift, ShiftRef, ShiftRequest, SiteRef, WorkSession } from '../../../types';

/**
 * Datos de prueba de "Mi asistencia" (solo los usan las pruebas). Hora del negocio: Centro de México
 * (UTC−6): el servidor responde a las 07:30 de un lunes y el turno es de 08:00 a 16:00.
 */

export const NOW = '2026-10-05T13:30:00Z';

export const sampleShift: ShiftRef = { id: 5, name: 'Matutino', start_time: '08:00:00', end_time: '16:00:00', overnight: false, weekdays: [0, 1, 2, 3, 4], remote_weekdays: [] };

/** Sitio de su turno (domicilio en Hermosillo, radio de 150 m). */
export const sampleSite: SiteRef = { id: 2, name: 'Planta Norte', address: siteAddress, latitude: 29.1, longitude: -110.9, radius_m: 150, active: true };

export const sampleOccurrence: Occurrence = {
  work_date: '2026-10-05',
  start: '2026-10-05T14:00:00Z',
  end: '2026-10-05T22:00:00Z',
  opens: '2026-10-05T13:45:00Z',
  deadline: '2026-10-05T23:00:00Z',
};

/** Jornada abierta: entró a las 07:55 en Planta Norte; dos descansos de 30 min permitidos. */
export function workSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: 6,
    work_date: '2026-10-05',
    shift_name: 'Matutino',
    scheduled_start: sampleOccurrence.start,
    scheduled_end: sampleOccurrence.end,
    check_out_deadline: sampleOccurrence.deadline,
    status: 'OPEN',
    check_in_at: '2026-10-05T13:55:00Z',
    check_in_mode: 'ON_SITE',
    check_in_site: 'Planta Norte',
    check_out_at: null,
    check_out_mode: null,
    check_out_site: null,
    late_minutes: 0,
    early_leave_minutes: 0,
    break_minutes: 0,
    worked_minutes: null,
    breaks_allowed: 2,
    break_minutes_allowed: 30,
    breaks: [],
    ...overrides,
  };
}

/** "Hoy" del servidor: por omisión, la ventana para checar la entrada está abierta (07:30). */
export function attendanceToday(overrides: Partial<AttendanceToday> = {}): AttendanceToday {
  return {
    now: NOW,
    shift: sampleShift,
    occurrence: sampleOccurrence,
    next_occurrence: null,
    session: null,
    actions: ['CHECK_IN'],
    remote_allowed: false,
    sites: [sampleSite],
    site_code: false,
    message: 'Tu turno es de 08:00 a 16:00: registra tu entrada.',
    ...overrides,
  };
}

/** Resultado de un registro verificado (entrada a las 07:55 en sitio). */
export function actionResult(overrides: Partial<AttendanceActionResult> = {}): AttendanceActionResult {
  return {
    verified: true,
    message: 'Entrada registrada',
    action: 'CHECK_IN',
    verification: { verified: true, method: 'FACE', message: 'Identidad confirmada', verified_at: '2026-10-05T13:55:00Z' },
    session: workSession(),
    ...overrides,
  };
}

export function companyShift(overrides: Partial<Shift> = {}): Shift {
  return {
    ...sampleShift,
    sites: [sampleSite],
    breaks_count: 2,
    break_minutes: 30,
    early_check_in_minutes: 15,
    late_tolerance_minutes: 10,
    early_check_out_minutes: 0,
    late_check_out_minutes: 60,
    duration_minutes: 480,
    active: true,
    employees: 4,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

export function shiftRequest(overrides: Partial<ShiftRequest> = {}): ShiftRequest {
  return {
    id: 4,
    employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' },
    shift: { id: 9, name: 'Vespertino', start_time: '14:00:00', end_time: '22:00:00', overnight: false, weekdays: [0, 1, 2, 3, 4], remote_weekdays: [], sites: [sampleSite] },
    current_shift: sampleShift,
    valid_from: '2026-10-12',
    reason: 'Entro a la escuela por las mañanas',
    status: 'PENDING',
    review_note: null,
    reviewed_at: null,
    created_at: '2026-10-04T18:00:00Z',
    ...overrides,
  };
}

/** Página de la API con todos los elementos. */
export function pageOf<T>(items: T[]) {
  return { items, total: items.length, page: 1, size: 10 };
}

/** Ventana de los descansos de la jornada de hoy (de 08:00 a 16:00, dos de 30 min). */
export function breakWindow(overrides: Partial<BreakWindow> = {}): BreakWindow {
  return { starts_at: sampleOccurrence.start, ends_at: sampleOccurrence.end, minutes: 30, remaining: 2, ...overrides };
}

/** Día libre: por omisión, vacaciones de dos semanas que empiezan hoy (5 oct 2026). */
export function dayOff(overrides: Partial<DayOff> = {}): DayOff {
  return { kind: 'VACATION', name: 'Vacaciones', work_date: '2026-10-05', starts_on: '2026-10-05', ends_on: '2026-10-18', ...overrides };
}

/** Una ausencia del empleado: por omisión, vacaciones que él pidió y siguen pendientes. */
export function absence(overrides: Partial<Absence> = {}): Absence {
  return {
    id: 11,
    employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' },
    type: 'VACATION',
    starts_on: '2026-12-01',
    ends_on: '2026-12-15',
    days: 15,
    note: null,
    status: 'PENDING',
    requested_by_employee: true,
    decided_at: null,
    decision_note: null,
    created_at: '2026-10-04T18:00:00Z',
    ...overrides,
  };
}

export function holiday(overrides: Partial<Holiday> = {}): Holiday {
  return { id: 3, holiday_date: '2026-12-25', name: 'Navidad', official: true, created_at: '2026-01-01T00:00:00Z', ...overrides };
}
