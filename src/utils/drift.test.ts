import { describe, expect, it } from 'vitest';
import { COMPANY_TONE, STATUS_TONE, changeText, measure, psiText, rateText, tailKey } from './drift';

describe('deriva: reglas de presentación', () => {
  it('cada estado tiene su tono (las alertas en rojo, lo no comparable apagado)', () => {
    expect(STATUS_TONE).toEqual({ OK: 'success', ALERT: 'danger', INSUFFICIENT: 'muted', NO_BASELINE: 'muted', VERSION_CHANGE: 'info' });
    expect(COMPANY_TONE.ALERT).toBe('danger');
    expect(COMPANY_TONE.INSUFFICIENT).toBe('muted');
  });

  it('escribe las medidas, el PSI, los cambios y las tasas; sin valor, un guion', () => {
    expect(measure(0.123456)).toBe('0.123');
    expect(measure(null)).toBe('—');
    expect(psiText(0.3)).toBe('0.3');
    expect(psiText(0.456)).toBe('0.46');
    expect(psiText(null)).toBe('—');
    expect(changeText(-0.42)).toBe('−42 %');
    expect(changeText(0.125)).toBe('+12.5 %');
    expect(changeText(0)).toBe('0 %');
    expect(changeText(null)).toBe('—');
    expect(rateText(0.8333)).toBe('83.3 %');
    expect(rateText(null)).toBe('—');
  });

  it('la cola vigilada es el 10 % más bajo o, en un máximo, el más alto', () => {
    expect(tailKey({ tail_percentile: 10 })).toBe('drift.tailLow');
    expect(tailKey({ tail_percentile: 90 })).toBe('drift.tailHigh');
  });
});
