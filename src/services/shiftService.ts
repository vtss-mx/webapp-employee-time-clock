import type {
  AssignmentPayload,
  BulkAssignmentPayload,
  BulkResult,
  PageQuery,
  Restored,
  Shift,
  ShiftAssignment,
  ShiftAssignmentList,
  ShiftList,
  ShiftPayload,
  ShiftRequest,
  ShiftRequestApproval,
  ShiftRequestList,
  ShiftRequestStatus,
} from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

export const isShift = hasKeys<Shift>('id', 'name', 'start_time', 'end_time', 'weekdays', 'remote_weekdays', 'sites', 'active');
export const isAssignment = hasKeys<ShiftAssignment>('id', 'shift', 'valid_from', 'state');
export const isShiftRequest = hasKeys<ShiftRequest>('id', 'employee', 'shift', 'valid_from', 'status');
/** Resultado de una operación para varios empleados (asignar un turno, registrar una ausencia). */
export const isBulkResult = hasKeys<BulkResult>('done', 'unchanged', 'skipped', 'results');

export interface ShiftListQuery extends PageQuery {
  search?: string;
  active?: boolean;
  /** Solo los de «Eliminados» (sin `active`). */
  deleted?: boolean;
}

/**
 * Turnos de la empresa (rol COMPANY, pantalla "Turnos"): el catálogo de turnos (cada uno dice dónde y
 * cuándo se checa: horario, sitios y días remotos), su asignación a cada empleado (solo el turno y
 * desde cuándo; con un día de anticipación si ya tiene uno) y las solicitudes de cambio.
 */
export const shiftService = {
  list(query: ShiftListQuery, signal?: AbortSignal): Promise<ShiftList> {
    return apiRequest<ShiftList>('/shifts', { query: { ...query }, signal, validate: isPage(isShift) });
  },

  get(id: number, signal?: AbortSignal): Promise<Shift> {
    return apiRequest<Shift>(`/shifts/${id}`, { signal, validate: isShift });
  },

  create(payload: ShiftPayload): Promise<Shift> {
    return apiRequest<Shift>('/shifts', { method: 'POST', body: payload, validate: isShift });
  },

  /** Aplica desde ahora a todos los que lo tienen asignado; lo ya registrado conserva su turno. */
  update(id: number, payload: ShiftPayload): Promise<Shift> {
    return apiRequest<Shift>(`/shifts/${id}`, { method: 'PUT', body: payload, validate: isShift });
  },

  setStatus(id: number, active: boolean): Promise<Shift> {
    return apiRequest<Shift>(`/shifts/${id}/status`, { method: 'PATCH', body: { active }, validate: isShift });
  },

  /** Solo si nadie lo tiene asignado (si no, 409 SHIFT_IN_USE: se desactiva); va a «Eliminados». */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/shifts/${id}`, { method: 'DELETE', validate: isNothing });
  },

  restore(id: number): Promise<Restored<Shift>> {
    return restoreRecord(`/shifts/${id}`, isShift);
  },

  // ---------- Asignaciones ----------

  /** Turnos del empleado: vigente, programados y anteriores (el más reciente primero); `deleted`: los cambios cancelados. */
  assignments(employeeId: number, query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<ShiftAssignmentList> {
    return apiRequest<ShiftAssignmentList>(`/employees/${employeeId}/shift-assignments`, { query: { ...query }, signal, validate: isPage(isAssignment) });
  },

  /** Lo ya registrado conserva su turno: la asignación vigente termina el día anterior al cambio. */
  assign(employeeId: number, payload: AssignmentPayload): Promise<ShiftAssignment> {
    return apiRequest<ShiftAssignment>(`/employees/${employeeId}/shift-assignments`, { method: 'POST', body: payload, validate: isAssignment });
  },

  /**
   * El mismo turno para varios empleados a la vez (hasta 500), con las reglas de asignar a uno: cada
   * uno queda asignado, sin cambios (ya lo tenía: un reintento no duplica) u omitido con su motivo.
   */
  assignMany(payload: BulkAssignmentPayload): Promise<BulkResult> {
    return apiRequest<BulkResult>('/shift-assignments/bulk', { method: 'POST', body: payload, validate: isBulkResult });
  },

  /** Cancela un cambio programado (aún no empieza): la asignación anterior vuelve a regir; va a «Eliminados». */
  async cancelAssignment(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/shift-assignments/${id}`, { method: 'DELETE', validate: isNothing });
  },

  /** Vuelve a programar un cambio cancelado (con las reglas de asignar: fecha, anticipación, turno activo). */
  restoreAssignment(id: number): Promise<Restored<ShiftAssignment>> {
    return restoreRecord(`/shift-assignments/${id}`, isAssignment);
  },

  // ---------- Solicitudes de cambio ----------

  requests(query: PageQuery & { status?: ShiftRequestStatus }, signal?: AbortSignal): Promise<ShiftRequestList> {
    return apiRequest<ShiftRequestList>('/shift-requests', { query: { ...query }, signal, validate: isPage(isShiftRequest) });
  },

  /** Solicitudes pendientes (contador del menú). */
  pendingRequests(signal?: AbortSignal): Promise<number> {
    return apiRequest<{ pending: number }>('/shift-requests/summary', { signal, validate: hasKeys<{ pending: number }>('pending') }).then((summary) => summary.pending);
  },

  approve(id: number, approval: ShiftRequestApproval = {}): Promise<ShiftRequest> {
    return apiRequest<ShiftRequest>(`/shift-requests/${id}/approve`, { method: 'POST', body: approval, validate: isShiftRequest });
  },

  reject(id: number, note: string): Promise<ShiftRequest> {
    return apiRequest<ShiftRequest>(`/shift-requests/${id}/reject`, { method: 'POST', body: { note: note.trim() }, validate: isShiftRequest });
  },
};
