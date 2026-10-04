import { describe, expect, it } from 'vitest';
import { formatMinutes, formatTime } from './format';
import { clockOf, shiftSchedule, weekdaysLabel } from './shifts';

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
});
