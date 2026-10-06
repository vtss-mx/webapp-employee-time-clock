import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { kindFrom, metricLink, perMinute, periodFrom, pointLabel, tabLink, vitalThresholds, vitalValue } from './performance';

describe('reglas de la pantalla Rendimiento', () => {
  it('periodo y tipo de la URL: lo desconocido es el periodo por omisión o ningún tipo', () => {
    expect(periodFrom('7d')).toBe('7d');
    expect(periodFrom('2y')).toBe('24h');
    expect(periodFrom(null)).toBe('24h');
    expect(kindFrom('WEB_API')).toBe('WEB_API');
    expect(kindFrom('http')).toBeNull();
  });

  it('etiquetas del eje según el periodo, en la zona del negocio; una fecha ilegible se muestra tal cual', () => {
    const at = '2026-10-04T15:00:00Z';
    expect(pointLabel(at, '1h')).toBe('09:00');
    expect(pointLabel(at, '7d')).toBe('4 oct, 09:00');
    expect(pointLabel(at, '30d')).toBe('4 oct');
    expect(pointLabel('no-es-fecha', '24h')).toBe('no-es-fecha');
  });

  it('enlaces: una métrica con su tipo, nombre y periodo; una pestaña sin el periodo por omisión', () => {
    expect(metricLink('FUNCTION', 'face.detect', '6h')).toBe('/admin/performance/metric?kind=FUNCTION&name=face.detect&period=6h');
    expect(tabLink('alerts', '24h')).toBe('/admin/performance?tab=alerts');
    expect(tabLink('routes', '30d')).toBe('/admin/performance?tab=routes&period=30d');
  });

  it('Web Vitals en milisegundos o puntaje, umbrales y peticiones por minuto en el idioma activo', async () => {
    expect(vitalValue(2500, 'ms')).toBe('2.5 s');
    expect(vitalValue(0.1234, 'score')).toBe('0.123');
    expect(vitalThresholds({ count: 1, p75: 1, unit: 'ms', rating: 'GOOD', good: 200, poor: 500 })).toBe('Buena hasta 200 ms; deficiente con más de 500 ms');
    expect(perMinute(1234.56)).toBe('1,234.6/min');
    await setLocale('en-US');
    expect(vitalThresholds({ count: 1, p75: 1, unit: 'score', rating: 'POOR', good: 0.1, poor: 0.25 })).toBe('Good up to 0.1; poor above 0.25');
    expect(pointLabel('2026-10-04T15:00:00Z', '24h')).toBe('9:00 AM');
  });
});
