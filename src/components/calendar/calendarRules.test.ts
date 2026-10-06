import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { formatDate } from '../../utils/format';
import {
  absenceFacts,
  addDays,
  addMonths,
  calendarDay,
  calendarDayPath,
  calendarPath,
  dateError,
  datesBetween,
  daysText,
  defaultDay,
  gridWeeks,
  isStale,
  isWeekend,
  longDate,
  monthBounds,
  monthName,
  monthOf,
  monthTitle,
  rangeError,
  rangeText,
  spanDays,
  tabFrom,
  weekdayIndex,
  weekdayName,
  weekdays,
} from './calendarRules';

const apiError = (statusCode: number, code: string) => new ApiError({ statusCode, code, message: 'x' });

describe('calendarRules', () => {
  it('pestañas de la URL y sus rutas', () => {
    expect(tabFrom('absences')).toBe('absences');
    expect(tabFrom('otra')).toBe('holidays');
    expect(tabFrom(null)).toBe('holidays');
    expect(calendarPath('holidays')).toBe('/company/calendar');
    expect(calendarPath('workdays')).toBe('/company/calendar?tab=workdays');
    expect(calendarDayPath('2026-10-12')).toBe('/company/calendar?date=2026-10-12');
  });

  it('el día de la URL: solo uno real y dentro de los años del backend', () => {
    expect(calendarDay('2026-10-12')).toBe('2026-10-12');
    expect(calendarDay('2000-01-01')).toBe('2000-01-01');
    expect(calendarDay('2100-12-31')).toBe('2100-12-31');
    expect(calendarDay('1999-12-31')).toBeNull();
    expect(calendarDay('2101-01-01')).toBeNull();
    expect(calendarDay('2026-02-31')).toBeNull();
    expect(calendarDay('mañana')).toBeNull();
    expect(calendarDay('')).toBeNull();
    expect(calendarDay(null)).toBeNull();
    expect(monthOf('2026-10-12')).toEqual({ year: 2026, month: 9 });
  });

  it('la cuadrícula: siempre 6 semanas de lunes a domingo con los días de los meses vecinos', () => {
    const october = gridWeeks(2026, 9); // el 1 de octubre de 2026 es jueves
    expect(october).toHaveLength(6);
    expect(october.every((week) => week.length === 7)).toBe(true);
    expect(october[0].slice(0, 4)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
    expect(october[5][6]).toBe('2026-11-08');
    // Febrero de 2027 empieza en lunes y ocupa 4 semanas: aun así son 6.
    const february = gridWeeks(2027, 1);
    expect(february[0][0]).toBe('2027-02-01');
    expect(february[5][6]).toBe('2027-03-14');
    expect(isWeekend('2026-10-10')).toBe(true);
    expect(isWeekend('2026-10-11')).toBe(true);
    expect(isWeekend('2026-10-12')).toBe(false);
  });

  it('cuenta días con ambos extremos y los nombra', () => {
    expect(spanDays('2026-10-01', '2026-10-03')).toBe(3);
    expect(spanDays('2026-03-01', '2026-03-31')).toBe(31); // con cambio de horario en algunos países
    expect(daysText(1)).toBe('1 día');
    expect(daysText(5)).toBe('5 días');
  });

  it('suma días y meses (el 31 pasa al último día de un mes más corto)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('límites del mes, sus días y el día que se elige al mostrarlo', () => {
    expect(monthBounds(2028, 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(datesBetween('2026-10-02', '2026-10-01')).toEqual([]);
    expect(defaultDay(2026, 9, '2026-10-04')).toBe('2026-10-04');
    expect(defaultDay(2026, 10, '2026-10-04')).toBe('2026-11-01');
  });

  it('nombres de meses y días de la semana', () => {
    expect(monthName(9, 'long')).toBe('Octubre');
    expect(monthName(0, 'short')).toBe('Ene');
    expect(weekdayName('2026-10-12')).toBe('Lunes');
  });

  it('nombres en español (fechas de calendario, sin zona)', () => {
    expect(longDate('2026-10-12')).toBe('Lunes, 12 de octubre de 2026');
    expect(monthTitle(2026, 9)).toBe('Octubre de 2026');
    expect(weekdays().map((day) => day.long)).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
    expect(weekdays()[0].short).toMatch(/^Lun/);
    expect(weekdayIndex('2026-10-12')).toBe(0);
    expect(weekdayIndex('2026-10-18')).toBe(6);
  });

  it('valida fechas y rangos de una ausencia', () => {
    expect(dateError('', 'Falta')).toBe('Falta');
    expect(dateError('31/02/2026', 'Falta')).toMatch(/fecha válida/);
    expect(dateError('2026-10-01', 'Falta')).toBeUndefined();
    expect(rangeError('', '2026-10-01')).toBeUndefined();
    expect(rangeError('2026-10-02', '2026-10-01')).toMatch(/anterior a la inicial/);
    expect(rangeError('2026-01-01', '2027-01-02')).toBe('Una ausencia dura a lo más 366 días');
    expect(rangeError('2026-01-01', '2027-01-01')).toBeUndefined(); // 366 días
  });

  it('texto de un rango', () => {
    expect(rangeText('2026-10-01', '2026-10-01')).toBe(formatDate('2026-10-01'));
    expect(rangeText('2026-10-01', '2026-10-05')).toBe(`${formatDate('2026-10-01')} al ${formatDate('2026-10-05')}`);
  });

  it('lo que se confirma de una ausencia: empleado y nota solo si los hay', () => {
    const employee = { full_name: 'Ana Ruiz', employee_number: 'EMP-7' };
    const range = { starts_on: '2026-10-01', ends_on: '2026-10-03', days: 3 };
    const dates = { label: 'Fechas', value: `${formatDate('2026-10-01')} al ${formatDate('2026-10-03')} · 3 días` };
    // Con empleado y nota (sin espacios sobrantes).
    expect(absenceFacts({ ...range, employee, note: '  Viaje familiar ' }, 'Vacaciones')).toEqual([
      { label: 'Empleado', value: 'Ana Ruiz · EMP-7' },
      { label: 'Tipo', value: 'Vacaciones' },
      dates,
      { label: 'Nota', value: 'Viaje familiar' },
    ]);
    // Sin empleado (aún no es de nadie: se está registrando) y sin nota.
    expect(absenceFacts(range, 'Vacaciones')).toEqual([{ label: 'Tipo', value: 'Vacaciones' }, dates]);
    expect(absenceFacts({ ...range, note: null }, 'Vacaciones')).toEqual([{ label: 'Tipo', value: 'Vacaciones' }, dates]);
    // Una nota de puros espacios no se muestra; un solo día se nombra en singular.
    expect(absenceFacts({ starts_on: '2026-10-01', ends_on: '2026-10-01', days: 1, employee, note: '   ' }, 'Permiso')).toEqual([
      { label: 'Empleado', value: 'Ana Ruiz · EMP-7' },
      { label: 'Tipo', value: 'Permiso' },
      { label: 'Fechas', value: `${formatDate('2026-10-01')} · 1 día` },
    ]);
  });

  it('un registro que ya cambió en el servidor', () => {
    expect(isStale(apiError(404, 'HOLIDAY_NOT_FOUND'))).toBe(true);
    expect(isStale(apiError(409, 'ABSENCE_CLOSED'))).toBe(true);
    expect(isStale(apiError(409, 'ABSENCE_OVERLAP'))).toBe(false);
    expect(isStale(new Error('x'))).toBe(false);
  });
});
