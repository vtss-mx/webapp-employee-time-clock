import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { formatMinutes, formatTime } from './format';
import { clockLabel, clockOf, shiftSchedule, weekdayName, weekdayOptions, weekdaysLabel } from './shifts';

describe('turnos: presentación', () => {
  it('días legibles: todos, rangos, pares, sueltos y ninguno', () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Todos los días');
    expect(weekdaysLabel([4, 0, 1, 2, 3])).toBe('Lun a vie');
    expect(weekdaysLabel([5, 6])).toBe('Sáb y dom');
    expect(weekdaysLabel([0, 2, 4])).toBe('Lun, mié, vie');
    expect(weekdaysLabel([3])).toBe('Jue');
    expect(weekdaysLabel([1, 1, 2])).toBe('Mar y mié');
    expect(weekdaysLabel([])).toBe('Ningún día');
  });

  it('horario del turno, también el que termina al día siguiente', () => {
    expect(clockOf('07:30:00')).toBe('07:30');
    expect(shiftSchedule({ start_time: '08:00:00', end_time: '16:00:00', overnight: false })).toBe('08:00 – 16:00');
    expect(shiftSchedule({ start_time: '22:00:00', end_time: '06:00:00', overnight: true })).toBe('22:00 – 06:00 (día siguiente)');
  });

  it('horas en la zona del negocio y duraciones', () => {
    expect(formatTime('2026-10-03T13:55:00Z')).toBe('07:55'); // hora del Centro (UTC-6)
    expect(formatTime(null)).toBe('—');
    expect(formatTime('no-es-fecha')).toBe('no-es-fecha');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(480)).toBe('8 h');
    expect(formatMinutes(440)).toBe('7 h 20 min');
    expect(formatMinutes(null)).toBe('—');
  });

  it('nombres de los días del idioma activo (de lunes a domingo)', () => {
    expect(weekdayOptions().map((day) => day.short)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(weekdayOptions().map((day) => day.name)).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
    expect(weekdayName(6, 'short')).toBe('dom');
    expect(clockLabel('07:05:00')).toBe('07:05');
  });

  it('en inglés (en-US): días, rangos, pares y horas de 12 h', async () => {
    await setLocale('en-US');
    expect(weekdayOptions().map((day) => day.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(weekdayOptions()[0].name).toBe('Monday');
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(weekdaysLabel([4, 0, 1, 2, 3])).toBe('Mon–Fri');
    expect(weekdaysLabel([5, 6])).toBe('Sat and Sun');
    expect(weekdaysLabel([0, 2, 4])).toBe('Mon, Wed, Fri');
    expect(weekdaysLabel([])).toBe('No days');
    expect(clockLabel('13:30')).toBe('1:30 PM');
    expect(shiftSchedule({ start_time: '08:00:00', end_time: '16:00:00', overnight: false })).toBe('8:00 AM – 4:00 PM');
    expect(shiftSchedule({ start_time: '22:00:00', end_time: '06:00:00', overnight: true })).toBe('10:00 PM – 6:00 AM (next day)');
  });
});
