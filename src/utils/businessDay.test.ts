import { describe, expect, it } from 'vitest';
import { businessDayEnd, businessDayStart, setBusinessTimeZone } from './format';

/**
 * El periodo que la persona elige en un filtro es el DÍA DE LA EMPRESA, no el del dispositivo ni UTC: la hora del
 * Centro de México está en UTC−6 (y en UTC−5 cuando hay horario de verano en otras zonas del negocio). Lo que se
 * envía al servidor son instantes con zona, calculados con la zona del negocio.
 */
describe('inicio y fin de un día en la zona del negocio', () => {
  it('la hora del Centro (UTC−6): el día va de las 06:00 a las 05:59:59.999 del siguiente, en UTC', () => {
    expect(businessDayStart('2026-10-01')).toBe('2026-10-01T06:00:00.000Z');
    expect(businessDayEnd('2026-10-01')).toBe('2026-10-02T05:59:59.999Z');
  });

  it('una zona con horario de verano: el desfase se corrige con el instante estimado, no con la hora pedida', () => {
    setBusinessTimeZone('America/New_York');
    // En invierno, Nueva York está en UTC−5.
    expect(businessDayStart('2026-01-15')).toBe('2026-01-15T05:00:00.000Z');
    // En verano, en UTC−4: el mismo cálculo da una hora distinta porque lo decide la fecha.
    expect(businessDayStart('2026-07-15')).toBe('2026-07-15T04:00:00.000Z');
    expect(businessDayEnd('2026-07-15')).toBe('2026-07-16T03:59:59.999Z');
    setBusinessTimeZone('America/Mexico_City');
  });

  it('una zona sin desfase (UTC) deja el día tal cual', () => {
    setBusinessTimeZone('UTC');
    expect(businessDayStart('2026-10-01')).toBe('2026-10-01T00:00:00.000Z');
    expect(businessDayEnd('2026-10-01')).toBe('2026-10-01T23:59:59.999Z');
    setBusinessTimeZone('America/Mexico_City');
  });

  it('un día incompleto o inválido no se envía (el filtro simplemente no viaja)', () => {
    expect(businessDayStart('')).toBeNull();
    expect(businessDayStart('2026-10')).toBeNull();
    expect(businessDayStart('aaaa-bb-cc')).toBeNull();
    expect(businessDayEnd('0000-00-00')).toBeNull();
    // Un año que JavaScript no puede representar tampoco es un día: el filtro no viaja.
    expect(businessDayStart('10000000-01-01')).toBeNull();
  });
});
