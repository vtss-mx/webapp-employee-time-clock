import type {
  Absence,
  AbsenceList,
  AbsencePayload,
  AbsenceRequestPayload,
  BulkResult,
  Holiday,
  HolidayList,
  HolidayPayload,
  OfficialHolidaysResult,
  PageQuery,
  ShiftRequestStatus,
  Workday,
  WorkdayList,
  WorkdayPayload,
} from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { isBulkResult } from './shiftService';

export const isHoliday = hasKeys<Holiday>('id', 'holiday_date', 'name', 'official');
export const isAbsence = hasKeys<Absence>('id', 'employee', 'type', 'starts_on', 'ends_on', 'status');
export const isWorkday = hasKeys<Workday>('id', 'employee', 'work_date');

export interface AbsenceQuery extends PageQuery {
  employee_id?: number;
  type?: string;
  status?: ShiftRequestStatus;
  /** Las que tocan el rango ("YYYY-MM-DD"). */
  start?: string;
  end?: string;
}

export interface WorkdayQuery extends PageQuery {
  employee_id?: number;
  start?: string;
  end?: string;
}

/** Quita los espacios de más de una nota; vacía no se envía. */
const note = (value: string | null | undefined) => value?.trim() || null;

/**
 * Calendario de días libres. La empresa (pantalla "Calendario"): festivos por año (y los oficiales con
 * un botón), ausencias de uno o varios empleados, las solicitudes por aprobar o rechazar y los días
 * laborables especiales. El empleado ("Mi asistencia"): sus ausencias, los próximos festivos y pedir
 * vacaciones o un permiso.
 */
export const calendarService = {
  // ---------- Festivos ----------

  holidays(query: PageQuery & { year: number }, signal?: AbortSignal): Promise<HolidayList> {
    return apiRequest<HolidayList>('/calendar/holidays', { query: { ...query }, signal, validate: isPage(isHoliday) });
  },

  createHoliday(payload: HolidayPayload): Promise<Holiday> {
    return apiRequest<Holiday>('/calendar/holidays', { method: 'POST', body: { ...payload, name: payload.name.trim() }, validate: isHoliday });
  },

  /** Idempotente: agrega solo los oficiales del año que faltan. */
  addOfficialHolidays(year: number): Promise<OfficialHolidaysResult> {
    return apiRequest<OfficialHolidaysResult>('/calendar/holidays/official', {
      method: 'POST',
      query: { year },
      validate: hasKeys<OfficialHolidaysResult>('year', 'added', 'existing'),
    });
  },

  async removeHoliday(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/calendar/holidays/${id}`, { method: 'DELETE', validate: isNothing });
  },

  // ---------- Ausencias ----------

  absences(query: AbsenceQuery, signal?: AbortSignal): Promise<AbsenceList> {
    return apiRequest<AbsenceList>('/calendar/absences', { query: { ...query }, signal, validate: isPage(isAbsence) });
  },

  /** Aprobada de una vez, para uno o varios empleados (vacaciones colectivas). */
  createAbsences(payload: AbsencePayload): Promise<BulkResult> {
    return apiRequest<BulkResult>('/calendar/absences', { method: 'POST', body: { ...payload, note: note(payload.note) }, validate: isBulkResult });
  },

  /** Solicitudes de vacaciones o permisos por decidir (contador del menú). */
  pendingAbsences(signal?: AbortSignal): Promise<number> {
    return apiRequest<{ pending: number }>('/calendar/absences/summary', { signal, validate: hasKeys<{ pending: number }>('pending') }).then((summary) => summary.pending);
  },

  approveAbsence(id: number): Promise<Absence> {
    return apiRequest<Absence>(`/calendar/absences/${id}/approve`, { method: 'POST', validate: isAbsence });
  },

  rejectAbsence(id: number, reason: string): Promise<Absence> {
    return apiRequest<Absence>(`/calendar/absences/${id}/reject`, { method: 'POST', body: { note: reason.trim() }, validate: isAbsence });
  },

  /** Sus días vuelven a ser laborables. */
  cancelAbsence(id: number): Promise<Absence> {
    return apiRequest<Absence>(`/calendar/absences/${id}/cancel`, { method: 'POST', validate: isAbsence });
  },

  // ---------- Días laborables especiales ----------

  workdays(query: WorkdayQuery, signal?: AbortSignal): Promise<WorkdayList> {
    return apiRequest<WorkdayList>('/calendar/workdays', { query: { ...query }, signal, validate: isPage(isWorkday) });
  },

  createWorkday(payload: WorkdayPayload): Promise<Workday> {
    return apiRequest<Workday>('/calendar/workdays', { method: 'POST', body: { ...payload, note: note(payload.note) }, validate: isWorkday });
  },

  async removeWorkday(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/calendar/workdays/${id}`, { method: 'DELETE', validate: isNothing });
  },

  // ---------- Empleado ----------

  myAbsences(query: PageQuery, signal?: AbortSignal): Promise<AbsenceList> {
    return apiRequest<AbsenceList>('/me/absences', { query: { ...query }, signal, validate: isPage(isAbsence) });
  },

  /** Vacaciones o permiso desde hoy: queda pendiente de la empresa. */
  requestAbsence(payload: AbsenceRequestPayload): Promise<Absence> {
    return apiRequest<Absence>('/me/absences', { method: 'POST', body: { ...payload, note: note(payload.note) }, validate: isAbsence });
  },

  cancelMyAbsence(id: number): Promise<Absence> {
    return apiRequest<Absence>(`/me/absences/${id}/cancel`, { method: 'POST', validate: isAbsence });
  },

  /** Los próximos festivos de su empresa (de hoy en adelante). */
  myHolidays(query: PageQuery, signal?: AbortSignal): Promise<HolidayList> {
    return apiRequest<HolidayList>('/me/holidays', { query: { ...query }, signal, validate: isPage(isHoliday) });
  },
};
