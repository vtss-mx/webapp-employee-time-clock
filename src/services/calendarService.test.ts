import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { attendanceService } from './attendanceService';
import { calendarService } from './calendarService';
import { employeeService } from './employeeService';
import { shiftService } from './shiftService';

const ref = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' };
const holiday = { id: 1, holiday_date: '2026-12-25', name: 'Navidad', official: true, created_at: 'x' };
const absence = { id: 2, employee: ref, type: 'VACATION', starts_on: '2026-12-01', ends_on: '2026-12-05', status: 'PENDING' };
const workday = { id: 3, employee: ref, work_date: '2026-12-25', note: null };
const bulk = { done: 1, unchanged: 0, skipped: 0, results: [] };
const detail = { id: 6, employee: ref, events: [], status: 'CLOSED' };
const page = <T,>(item: T) => ({ items: [item], total: 1, page: 1, size: 10 });
const times = { check_in: '08:00', check_out: '16:00', breaks: [{ start: '12:00', end: '12:30' }], reason: 'Olvidó checar' };

afterEach(() => vi.unstubAllGlobals());

describe('calendario, operaciones masivas y jornadas de la empresa', () => {
  it.each([
    ['holidays', () => calendarService.holidays({ year: 2026, page: 1, size: 10 }), page(holiday), 'GET', '/api/calendar/holidays?year=2026&page=1&size=10'],
    ['createHoliday', () => calendarService.createHoliday({ holiday_date: '2026-12-25', name: ' Navidad ' }), holiday, 'POST', '/api/calendar/holidays'],
    ['addOfficialHolidays', () => calendarService.addOfficialHolidays(2027), { year: 2027, added: [holiday], existing: 0 }, 'POST', '/api/calendar/holidays/official?year=2027'],
    ['removeHoliday', () => calendarService.removeHoliday(1), null, 'DELETE', '/api/calendar/holidays/1'],
    ['absences', () => calendarService.absences({ page: 1, size: 10, status: 'PENDING', type: 'VACATION' }), page(absence), 'GET', '/api/calendar/absences?page=1&size=10&status=PENDING&type=VACATION'],
    ['createAbsences', () => calendarService.createAbsences({ employee_ids: [7], type: 'VACATION', starts_on: '2026-12-01', ends_on: '2026-12-05', note: '  ' }), bulk, 'POST', '/api/calendar/absences'],
    ['approveAbsence', () => calendarService.approveAbsence(2), absence, 'POST', '/api/calendar/absences/2/approve'],
    ['rejectAbsence', () => calendarService.rejectAbsence(2, ' Inventario '), absence, 'POST', '/api/calendar/absences/2/reject'],
    ['cancelAbsence', () => calendarService.cancelAbsence(2), absence, 'POST', '/api/calendar/absences/2/cancel'],
    ['workdays', () => calendarService.workdays({ page: 1, size: 10, employee_id: 7 }), page(workday), 'GET', '/api/calendar/workdays?page=1&size=10&employee_id=7'],
    ['createWorkday', () => calendarService.createWorkday({ employee_id: 7, work_date: '2026-12-25', note: ' Guardia ' }), workday, 'POST', '/api/calendar/workdays'],
    ['removeWorkday', () => calendarService.removeWorkday(3), null, 'DELETE', '/api/calendar/workdays/3'],
    ['myAbsences', () => calendarService.myAbsences({ page: 1, size: 10 }), page(absence), 'GET', '/api/me/absences?page=1&size=10'],
    ['requestAbsence', () => calendarService.requestAbsence({ type: 'VACATION', starts_on: '2026-12-01', ends_on: '2026-12-05' }), absence, 'POST', '/api/me/absences'],
    ['cancelMyAbsence', () => calendarService.cancelMyAbsence(2), absence, 'POST', '/api/me/absences/2/cancel'],
    ['myHolidays', () => calendarService.myHolidays({ page: 1, size: 10 }), page(holiday), 'GET', '/api/me/holidays?page=1&size=10'],
    ['shifts.assignMany', () => shiftService.assignMany({ shift_id: 5, employee_ids: [7, 8], valid_from: '2026-10-06' }), bulk, 'POST', '/api/shift-assignments/bulk'],
    ['employees.ids', () => employeeService.ids({ search: 'ana', department_id: 2 }), { ids: [7], total: 1, limit: 500 }, 'GET', '/api/employees/ids?search=ana&department_id=2'],
    ['attendance.createSession', () => attendanceService.createSession({ ...times, employee_id: 7, work_date: '2026-10-05' }), detail, 'POST', '/api/attendance/sessions'],
    ['attendance.correctSession', () => attendanceService.correctSession(6, times), detail, 'PUT', '/api/attendance/sessions/6'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('los textos viajan sin espacios sobrantes y una nota vacía no se envía', async () => {
    const { calls } = mockFetch((call) => apiOk(call.url.includes('workdays') ? workday : call.url.includes('holidays') ? holiday : call.url.endsWith('/absences') && call.url.includes('calendar') ? bulk : absence));
    await calendarService.createHoliday({ holiday_date: '2026-12-25', name: ' Navidad ' });
    await calendarService.createAbsences({ employee_ids: [7], type: 'VACATION', starts_on: '2026-12-01', ends_on: '2026-12-05', note: '  ' });
    await calendarService.rejectAbsence(2, ' Inventario ');
    await calendarService.createWorkday({ employee_id: 7, work_date: '2026-12-25', note: ' Guardia ' });
    await calendarService.requestAbsence({ type: 'PERMISSION', starts_on: '2026-12-03', ends_on: '2026-12-03', note: ' Cita médica ' });
    const bodies = calls.map((c) => JSON.parse(c.init.body as string) as Record<string, unknown>);
    expect(bodies[0]).toEqual({ holiday_date: '2026-12-25', name: 'Navidad' });
    expect(bodies[1].note).toBeNull();
    expect(bodies[2]).toEqual({ note: 'Inventario' });
    expect(bodies[3].note).toBe('Guardia');
    expect(bodies[4].note).toBe('Cita médica');
  });

  it('el contador del menú es el número de pendientes', async () => {
    mockFetch(apiOk({ pending: 4 }));
    await expect(calendarService.pendingAbsences()).resolves.toBe(4);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    mockFetch(apiOk({ id: 1 }));
    await expect(calendarService.createHoliday({ holiday_date: '2026-12-25', name: 'Navidad' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(shiftService.assignMany({ shift_id: 5, employee_ids: [7], valid_from: '2026-10-06' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
