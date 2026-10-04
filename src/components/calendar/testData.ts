import { apiOk, mockFetch, type MockCall } from '../../test/http';
import type { Absence, Holiday, Workday } from '../../types';
import { businessToday } from '../../utils/format';
import { ana, page } from '../employees/testData';
import { addDays, monthBounds } from './calendarRules';

/** Datos de prueba del calendario (los comparten sus pestañas y formularios), relativos a hoy. */
export const today = businessToday();
export const year = Number(today.slice(0, 4));
export const monthIndex = Number(today.slice(5, 7)) - 1;
export const { start: first, end: last } = monthBounds(year, monthIndex);
export const third = addDays(first, 2);
/** Evento con que se avisa al contador del menú (`notifyAbsenceRequestsChanged`). */
export const ABSENCES_CHANGED = 'tc:absence-requests-changed';

const created = '2026-01-02T10:00:00Z';
export const anniversary: Holiday = { id: 2, holiday_date: first, name: 'Aniversario', official: false, created_at: created };
export const christmas: Holiday = { id: 1, holiday_date: `${year}-12-25`, name: 'Navidad', official: true, created_at: created };
export const vacation: Absence = {
  id: 10,
  employee: ana,
  type: 'VACATION',
  starts_on: first,
  ends_on: third,
  days: 3,
  note: 'Viaje familiar',
  status: 'APPROVED',
  requested_by_employee: false,
  decided_at: created,
  decision_note: null,
  created_at: created,
};
export const request: Absence = { ...vacation, id: 11, type: 'PERMISSION', ends_on: first, days: 1, note: 'Trámite', status: 'PENDING', requested_by_employee: true, created_at: new Date(Date.now() - 3 * 3600_000).toISOString() };
export const workday: Workday = { id: 20, employee: ana, work_date: last, note: 'Cubre la guardia', created_at: created };

/** El calendario como lo responde el servidor; `extra(call)` responde primero (null: sigue). */
export function calendarServer(extra: (call: MockCall) => Response | Promise<Response> | null = () => null) {
  return mockFetch((call) => {
    const answer = extra(call);
    if (answer) return answer;
    if (call.init.method === 'DELETE') return apiOk(null);
    if (call.url.startsWith('/api/calendar/absences/summary')) return apiOk({ pending: 1 });
    if (call.url.startsWith('/api/calendar/holidays')) return apiOk(page([anniversary, christmas]));
    if (call.url.startsWith('/api/calendar/workdays')) return apiOk(page([workday]));
    return apiOk(page(call.url.includes('status=PENDING') ? [request] : [vacation]));
  });
}
