import type {
  AttendanceAction,
  AttendanceActionResult,
  AttendanceBoard,
  AttendanceHistory,
  AttendanceToday,
  CompanySessionDetail,
  CompanySessionList,
  ManualSessionPayload,
  ManualTimesPayload,
  PageQuery,
  ShiftList,
  ShiftRequest,
  ShiftRequestList,
  ShiftRequestPayload,
  WorkSessionStatus,
} from '../types';
import type { DeviceLocation } from '../utils/geolocation';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';
import { isShift, isShiftRequest } from './shiftService';

const isSession = hasKeys('id', 'work_date', 'status', 'check_in_at', 'breaks');
const isToday = hasKeys<AttendanceToday>('now', 'actions', 'message', 'sites');
const isActionResult = hasKeys<AttendanceActionResult>('verified', 'message', 'action', 'verification');
const isBoard = (value: unknown): value is AttendanceBoard => isPage(hasKeys('employee', 'state', 'shift_name'))(value) && hasKeys('work_date', 'working')(value);
const isDetail = hasKeys<CompanySessionDetail>('id', 'employee', 'events', 'status');

/**
 * Cada acción en la URL del backend y en la ruta de la app (`paths.employee.recordAttendance`): una
 * sola tabla para que la pantalla que registra y la API nunca difieran.
 */
export const ATTENDANCE_SLUGS = {
  CHECK_IN: 'check-in',
  BREAK_START: 'break-start',
  BREAK_END: 'break-end',
  CHECK_OUT: 'check-out',
} as const satisfies Record<AttendanceAction, string>;

export type AttendanceSlug = (typeof ATTENDANCE_SLUGS)[AttendanceAction];

export interface SessionHistoryQuery extends PageQuery {
  employee_id?: number;
  /** "YYYY-MM-DD" (días de la hora del negocio). */
  start?: string;
  end?: string;
  status?: WorkSessionStatus;
}

/**
 * Asistencia por turno. La empresa ve el tablero del día, el historial y la evidencia de cada jornada;
 * el empleado ve qué puede registrar ahora (lo decide el servidor), registra con su rostro y su
 * ubicación (la hora la pone el servidor) y pide cambios de turno.
 */
export const attendanceService = {
  // ---------- Empresa ----------

  /** Tablero de un día ("YYYY-MM-DD"; por omisión, hoy en la hora del negocio). */
  board(query: PageQuery & { date?: string; search?: string }, signal?: AbortSignal): Promise<AttendanceBoard> {
    return apiRequest<AttendanceBoard>('/attendance/board', { query: { ...query }, signal, validate: isBoard });
  },

  sessions(query: SessionHistoryQuery, signal?: AbortSignal): Promise<CompanySessionList> {
    return apiRequest<CompanySessionList>('/attendance/sessions', { query: { ...query }, signal, validate: isPage(hasKeys('id', 'employee', 'status')) });
  },

  session(id: number, signal?: AbortSignal): Promise<CompanySessionDetail> {
    return apiRequest<CompanySessionDetail>(`/attendance/sessions/${id}`, { signal, validate: isDetail });
  },

  /** La empresa registra la jornada de quien no checó (sin rostro ni ubicación, con motivo). */
  createSession(payload: ManualSessionPayload): Promise<CompanySessionDetail> {
    return apiRequest<CompanySessionDetail>('/attendance/sessions', { method: 'POST', body: payload, validate: isDetail });
  },

  /** Corrige las horas y los descansos de una jornada (lo anterior queda en la bitácora). */
  correctSession(id: number, payload: ManualTimesPayload): Promise<CompanySessionDetail> {
    return apiRequest<CompanySessionDetail>(`/attendance/sessions/${id}`, { method: 'PUT', body: payload, validate: isDetail });
  },

  // ---------- Empleado ----------

  today(signal?: AbortSignal): Promise<AttendanceToday> {
    return apiRequest<AttendanceToday>('/me/attendance/today', { signal, validate: isToday });
  },

  /**
   * Registra una acción con el rostro (capturas + prueba de vida) y la ubicación del navegador. Sin un
   * rostro verificado no se registra nada (`verified: false`); la hora es la del servidor.
   */
  record(action: AttendanceAction, captures: FaceCaptures, location: DeviceLocation): Promise<AttendanceActionResult> {
    const extra = { latitude: String(location.latitude), longitude: String(location.longitude), accuracy: String(Math.min(location.accuracy, 100_000)) };
    return postFaceCaptures(`/me/attendance/${ATTENDANCE_SLUGS[action]}`, captures, isActionResult, extra);
  },

  history(query: PageQuery, signal?: AbortSignal): Promise<AttendanceHistory> {
    return apiRequest<AttendanceHistory>('/me/attendance/history', { query: { ...query }, signal, validate: isPage(isSession) });
  },

  /** Turnos activos de su empresa (para pedir un cambio). */
  availableShifts(query: PageQuery, signal?: AbortSignal): Promise<ShiftList> {
    return apiRequest<ShiftList>('/me/shifts', { query: { ...query }, signal, validate: isPage(isShift) });
  },

  myRequests(query: PageQuery, signal?: AbortSignal): Promise<ShiftRequestList> {
    return apiRequest<ShiftRequestList>('/me/shift-requests', { query: { ...query }, signal, validate: isPage(isShiftRequest) });
  },

  /** Con al menos un día de anticipación; una sola pendiente a la vez (409 SHIFT_REQUEST_PENDING). */
  requestChange(payload: ShiftRequestPayload): Promise<ShiftRequest> {
    return apiRequest<ShiftRequest>('/me/shift-requests', { method: 'POST', body: { ...payload, reason: payload.reason.trim() }, validate: isShiftRequest });
  },

  cancelRequest(id: number): Promise<ShiftRequest> {
    return apiRequest<ShiftRequest>(`/me/shift-requests/${id}/cancel`, { method: 'POST', validate: isShiftRequest });
  },
};
