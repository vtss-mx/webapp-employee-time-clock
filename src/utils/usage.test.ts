import { describe, expect, it } from 'vitest';
import { dayLabel, defaultRange, rangeDays, rangeErrors, usagePresets } from './usage';

describe('rango de días del consumo', () => {
  it('rangos de un clic: hoy, este mes y el mes pasado (sin repetir el día 1)', () => {
    expect(usagePresets(new Date(2026, 9, 4)).map((range) => [range.key, range.start, range.end])).toEqual([
      ['today', '2026-10-04', '2026-10-04'],
      ['month', '2026-10-01', '2026-10-04'],
      ['last-month', '2026-09-01', '2026-09-30'],
    ]);
    expect(usagePresets(new Date(2026, 9, 1)).map((range) => range.key)).toEqual(['today', 'last-month']);
    expect(usagePresets().length).toBeGreaterThan(1);
  });

  it('por omisión, este mes (del día 1 a hoy)', () => {
    expect(defaultRange(new Date(2026, 9, 4))).toEqual({ start: '2026-10-01', end: '2026-10-04' });
    expect(defaultRange().start).toMatch(/-01$/);
  });

  it('días que abarca y qué impide consultarlo', () => {
    expect(rangeDays({ start: '2026-10-01', end: '2026-10-01' })).toBe(1);
    expect(rangeDays({ start: '2025-10-01', end: '2026-09-30' })).toBe(365);
    expect(rangeErrors({ start: '2026-10-01', end: '2026-10-04' })).toEqual({});
    expect(rangeErrors({ start: '', end: '2026-10-04' })).toEqual({ start: 'Escribe una fecha válida', end: undefined });
    expect(rangeErrors({ start: '2026-10-01', end: '2026-02-31' })).toEqual({ start: undefined, end: 'Escribe una fecha válida' });
    expect(rangeErrors({ start: '2026-10-05', end: '2026-10-04' })).toEqual({ end: 'Debe ser igual o posterior a «Desde»' });
    expect(rangeErrors({ start: '2025-01-01', end: '2026-01-02' })).toEqual({ end: 'El rango es de hasta 366 días' });
  });

  it('etiqueta corta de cada día de las gráficas', () => {
    expect(dayLabel('2026-10-04')).toBe('4 oct');
    expect(dayLabel('mal')).toBe('mal');
  });
});
