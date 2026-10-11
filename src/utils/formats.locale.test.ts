import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { businessTimeZone, formatConfidence, formatDate, formatDateTime, formatMinutes, localeDateFormat, setBusinessTimeZone, timeAgo, timeStyle } from './format';
import { formatCount, formatDistance, formatList, formatMoney, formatNumber, formatRate, localeNumberFormat } from './numbers';

/**
 * Formatos en el idioma activo (regla 16): fechas, horas (12 h en en-US), duraciones, números,
 * distancias, listas y dinero cambian al instante con el idioma, siempre en la zona del negocio.
 */
const INSTANT = '2026-05-10T19:55:00Z'; // 13:55 en la Ciudad de México

describe('fechas y horas por idioma', () => {
  it('es-MX: 24 h para los registros y el formato de siempre', () => {
    expect(formatDate('1990-05-10')).toBe('10 may 1990');
    expect(formatDate(INSTANT)).toBe('10 may 2026');
    expect(formatDateTime(INSTANT)).toMatch(/^10 may 2026, 1:55\sp\.\s?m\.$/);
    expect(timeStyle()).toMatchObject({ hourCycle: 'h23' });
    expect(formatMinutes(440)).toBe('7 h 20 min');
    expect(formatMinutes(null)).toBe('—'); // sin dato: el guion, no «0 min»
  });

  it('en-US: reloj de 12 horas, orden y nombres en inglés, en la misma zona del negocio', async () => {
    await setLocale('en-US');
    expect(formatDate('1990-05-10')).toBe('May 10, 1990');
    expect(formatDateTime(INSTANT)).toMatch(/^May 10, 2026, 1:55\sPM$/);
    expect(timeAgo(new Date().toISOString())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5 minutes ago');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatConfidence(0.95)).toBe('95%');
    expect(localeDateFormat({ weekday: 'long', timeZone: 'UTC' }).format(new Date('2026-10-05T12:00:00Z'))).toBe('Monday');
    expect(businessTimeZone()).toBe('America/Mexico_City');
  });

  it('la zona del negocio se conserva al cambiar de idioma (y una desconocida se ignora)', async () => {
    setBusinessTimeZone('America/Hermosillo');
    setBusinessTimeZone('Zona/Inexistente');
    expect(businessTimeZone()).toBe('America/Hermosillo');
    await setLocale('en-US');
    setBusinessTimeZone('America/Mexico_City');
  });
});

describe('números, dinero, distancias y listas por idioma', () => {
  it('es-MX', () => {
    expect(formatNumber(1234.5678)).toBe('1,234.568');
    expect(formatNumber(null)).toBe('—');
    expect(formatCount(12345)).toBe('12,345');
    expect(formatRate(16)).toBe('16 %');
    expect(formatMoney('1234.5', 'MXN')).toBe('$1,234.50\u00a0MXN');
    expect(formatMoney('10', 'USD')).toBe('$10.00\u00a0USD');
    expect(formatDistance(349.6)).toBe('350 m');
    expect(formatDistance(1250)).toBe('1.3 km');
    expect(formatDistance(1250, 3)).toBe('1.25 km');
    expect(formatList(['Ana', 'Luis', 'Eva'])).toBe('Ana, Luis y Eva');
    expect(formatList(['Ana', 'Luis'], 'disjunction')).toBe('Ana o Luis');
    expect(localeNumberFormat()).toBe(localeNumberFormat()); // un formato por idioma y opciones
  });

  it('en-US', async () => {
    await setLocale('en-US');
    expect(formatRate(16)).toBe('16%');
    // El mismo formato en los dos idiomas: símbolo, monto y código ISO (sin ambigüedad entre pesos y dólares).
    expect(formatMoney('1234.5', 'MXN')).toBe('$1,234.50\u00a0MXN');
    expect(formatMoney('1234.5', 'USD')).toBe('$1,234.50\u00a0USD');
    expect(formatMoney('1234.5', 'EUR')).toBe('€1,234.50\u00a0EUR');
    expect(formatList(['Ana', 'Luis', 'Eva'])).toBe('Ana, Luis, and Eva');
    expect(formatDistance(800)).toBe('800 m'); // las distancias del backend van en metros
  });
});
