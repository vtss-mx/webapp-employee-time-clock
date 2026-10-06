import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, formatDuration, formatMoney, formatRate, moneyValue } from './numbers';

describe('formatos de cantidades (es-MX)', () => {
  it('dinero del contrato: número, en su moneda con el código ISO y "—" sin valor o sin moneda', () => {
    expect(moneyValue('1234.50')).toBe(1234.5);
    expect(moneyValue(7)).toBe(7);
    expect(moneyValue('abc')).toBe(0);
    expect(moneyValue(null)).toBe(0);
    expect(formatMoney('1234.5', 'MXN')).toBe('$1,234.50\u00a0MXN');
    expect(formatMoney(-20, 'MXN')).toBe('-$20.00\u00a0MXN');
    expect(formatMoney('0.00', 'USD')).toBe('$0.00\u00a0USD');
    expect(formatMoney('10', 'EUR')).toBe('€10.00\u00a0EUR');
    expect(formatMoney('1235.00', 'JPY')).toBe('¥1,235\u00a0JPY'); // los decimales de la moneda (ISO 4217)
    expect(formatMoney('10', 'USD')).toBe(formatMoney('10', 'USD')); // el formato de cada moneda se reutiliza
    expect(formatMoney(null, 'MXN')).toBe('—');
    expect(formatMoney(undefined, 'MXN')).toBe('—');
    expect(formatMoney('', 'MXN')).toBe('—');
    expect(formatMoney('0.00', null)).toBe('—');
  });

  it('porcentaje de 0 a 100 con los decimales pedidos', () => {
    expect(formatRate('16.00', 2)).toBe('16 %');
    expect(formatRate(12.345)).toBe('12.3 %');
    expect(formatRate(12.345, 2)).toBe('12.35 %');
    expect(formatRate(null)).toBe('—');
    expect(formatRate('')).toBe('—');
  });

  it('conteos, datos (siempre en MB) y tiempo de proceso legibles', () => {
    expect(formatCount(12345)).toBe('12,345');
    expect(formatCount(null)).toBe('—');
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(-5)).toBe('0 MB');
    expect(formatBytes(1536)).toBe('< 0.01 MB'); // menos de un centésimo de MB
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.00 MB');
    expect(formatBytes(2.25 * 1024 ** 3)).toBe('2,304.00 MB'); // nunca GB: todo en MB
    expect(formatBytes(undefined)).toBe('—');
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(123.4)).toBe('123.4 ms');
    expect(formatDuration(12_400)).toBe('12.4 s');
    expect(formatDuration(210_000)).toBe('3.5 min');
    expect(formatDuration(7_560_000)).toBe('2.1 h');
    expect(formatDuration(-1)).toBe('0 ms');
    expect(formatDuration(null)).toBe('—');
  });
});
