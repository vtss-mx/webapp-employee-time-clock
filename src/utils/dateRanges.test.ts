import { describe, expect, it } from 'vitest';
import { quickRanges } from './dateRanges';

describe('rangos de un clic', () => {
  it('con el "hoy" de la empresa: hoy, ayer, semanas desde el lunes, meses y los últimos 30 días', () => {
    const ranges = quickRanges(new Date(2026, 9, 7)); // miércoles 7 de octubre de 2026
    expect(Object.fromEntries(ranges.map((r) => [r.key, [r.start, r.end]]))).toEqual({
      today: ['2026-10-07', '2026-10-07'],
      yesterday: ['2026-10-06', '2026-10-06'],
      week: ['2026-10-05', '2026-10-07'],
      'last-week': ['2026-09-28', '2026-10-04'],
      month: ['2026-10-01', '2026-10-07'],
      'last-month': ['2026-09-01', '2026-09-30'],
      'last-30': ['2026-09-08', '2026-10-07'],
    });
    expect(quickRanges(new Date(2026, 9, 4)).find((r) => r.key === 'week')?.start).toBe('2026-09-28'); // domingo: su semana empezó el lunes anterior
  });
});
