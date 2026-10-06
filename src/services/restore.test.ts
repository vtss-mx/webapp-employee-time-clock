import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { adminService } from './adminService';
import { ApiError } from './apiClient';
import { calendarService } from './calendarService';
import { departmentService } from './departmentService';
import { employeeService } from './employeeService';
import { shiftService } from './shiftService';
import { siteService } from './siteService';
import { validatorService } from './validatorService';

const employee = { id: 7, employee_number: 'EMP-7', first_name: 'Ana', last_name: 'Ruiz' };
const validator = { id: 2, name: 'Recepción', email: 'r@empresa.com', mode: 'QR', active: true };
const company = { id: 4, name: 'Panificadora', active: true, employee_count: 0 };
const department = { id: 3, name: 'Producción', employee_count: 0, managers: [] };
const site = { id: 5, name: 'Planta Norte', address: {}, radius_m: 100, active: true };
const shift = { id: 6, name: 'Matutino', start_time: '08:00:00', end_time: '16:00:00', weekdays: [0], remote_weekdays: [], sites: [], active: true };
const assignment = { id: 8, shift, valid_from: '2026-10-06', state: 'SCHEDULED' };
const holiday = { id: 9, holiday_date: '2026-12-25', name: 'Navidad', official: true };
const workday = { id: 10, employee: { id: 7 }, work_date: '2026-12-25' };
const page = { items: [], total: 0, page: 1, size: 10, active: 0, limit: 3 };

/** Cada restauración: POST a `{ruta}/restore`; devuelve el registro y el mensaje del servidor (el texto del aviso). */
const RESTORES: Array<[string, () => Promise<{ item: unknown; message: string }>, string, unknown]> = [
  ['empleado', () => employeeService.restore(7), '/api/employees/7/restore', employee],
  ['validador', () => validatorService.restore(2), '/api/validators/2/restore', validator],
  ['empresa', () => adminService.restore(4), '/api/admin/companies/4/restore', company],
  ['departamento', () => departmentService.restore(3), '/api/departments/3/restore', department],
  ['sitio', () => siteService.restore(5), '/api/sites/5/restore', site],
  ['turno', () => shiftService.restore(6), '/api/shifts/6/restore', shift],
  ['cambio de turno', () => shiftService.restoreAssignment(8), '/api/shift-assignments/8/restore', assignment],
  ['festivo', () => calendarService.restoreHoliday(9), '/api/calendar/holidays/9/restore', holiday],
  ['día laborable', () => calendarService.restoreWorkday(10), '/api/calendar/workdays/10/restore', workday],
];

describe('Servicios: «Eliminados» y restaurar', () => {
  it.each(RESTORES)('restaurar un %s: POST a su ruta, el registro y el mensaje del servidor', async (_name, call, url, item) => {
    const { calls } = mockFetch(apiOk(item, { code: 'RESTORED', message: 'Restaurado.' }));
    await expect(call()).resolves.toEqual({ item, message: 'Restaurado.' });
    expect(calls[0].url).toBe(url);
    expect(calls[0].init.method).toBe('POST');
  });

  it('una respuesta sin la forma del registro es un error (no se muestra algo a medias)', async () => {
    mockFetch(apiOk({ id: 7 }));
    await expect(employeeService.restore(7)).rejects.toBeInstanceOf(ApiError);
  });

  it('cada listado pide «Eliminados» con deleted=true', async () => {
    const { calls } = mockFetch(apiOk(page));
    await validatorService.list({ page: 1, size: 10, deleted: true });
    await departmentService.list({ page: 1, size: 10, deleted: true });
    await shiftService.assignments(7, { page: 1, size: 10, deleted: true });
    await calendarService.holidays({ page: 1, size: 10, year: 2026, deleted: true });
    await calendarService.workdays({ page: 1, size: 10, deleted: true });
    await employeeService.list({ deleted: true, page: 1, size: 10 });
    await adminService.list({ deleted: true, page: 1, size: 10 });
    await siteService.list({ page: 1, size: 10, deleted: true });
    await shiftService.list({ page: 1, size: 10, deleted: true });
    expect(calls.map((call) => call.url)).toEqual([
      '/api/validators?page=1&size=10&deleted=true',
      '/api/departments?page=1&size=10&deleted=true',
      '/api/employees/7/shift-assignments?page=1&size=10&deleted=true',
      '/api/calendar/holidays?page=1&size=10&year=2026&deleted=true',
      '/api/calendar/workdays?page=1&size=10&deleted=true',
      '/api/employees?deleted=true&page=1&size=10',
      '/api/admin/companies?deleted=true&page=1&size=10',
      '/api/sites?page=1&size=10&deleted=true',
      '/api/shifts?page=1&size=10&deleted=true',
    ]);
  });
});
