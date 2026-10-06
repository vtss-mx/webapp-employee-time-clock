import { currentLocale } from '../../i18n/core';
import { config } from '../../utils/config';
import { buildUrl, currentAccessToken } from '../apiClient';

/**
 * Muestras de rendimiento del navegador: un búfer en memoria con tope y su envío al backend propio
 * (`POST /api/telemetry/web`, contrato `WebPerfBatch`). Nada se guarda en el navegador (regla 13): lo que no se
 * envió se pierde con la página.
 *
 * El envío es de mejor esfuerzo: `fetch` con `keepalive` (sobrevive al cierre de la pestaña), tiempo límite, sin
 * reintentos y sin popups; un lote que no llega (sin red, 429, 413) se descarta. No se usa `navigator.sendBeacon`
 * porque no puede llevar la cabecera `Authorization`: sin ella el backend trataría todo como anónimo y solo
 * conservaría lo del inicio de sesión. Este envío no pasa por `apiClient`, así que nunca se mide a sí mismo.
 */

export type SampleKind = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB' | 'LONG_TASK' | 'API';

export interface PerfSample {
  kind: SampleKind;
  /** Plantilla de la pantalla (Web Vitals y tareas largas) o "MÉTODO /api/ruta-con-{id}" (API). */
  name: string;
  /** Milisegundos (CLS: el puntaje sin unidad). */
  value: number;
  /** Solo API: código HTTP; 0 = sin red; 408 = tiempo agotado del cliente. */
  status?: number;
}

const TELEMETRY_PATH = '/telemetry/web';
/** Límites del contrato: nombre de 1 a 200 caracteres y valor de 0 a 600 000. */
const MAX_NAME = 200;
const MAX_VALUE = 600_000;
/**
 * Tamaño máximo del cuerpo: el backend rechaza más de 64 KB (413) y el navegador limita a 64 KB lo que llevan
 * juntas las peticiones `keepalive` en curso. Con margen para el resto del lote; lo que no cabe se descarta.
 */
const MAX_BODY_CHARS = 60_000;

let samples: PerfSample[] = [];

/** Valor en el rango del contrato: CLS con 4 decimales, tiempos con 1. */
function bounded(kind: SampleKind, value: number): number {
  const digits = kind === 'CLS' ? 10_000 : 10;
  return Math.round(Math.min(MAX_VALUE, Math.max(0, value)) * digits) / digits;
}

/** Guarda una muestra si hay lugar (el tope es `config.perf.maxSamples`; lo que sobra se descarta). */
export function record(sample: PerfSample): void {
  if (samples.length >= config.perf.maxSamples) return;
  samples.push({ ...sample, name: sample.name.slice(0, MAX_NAME), value: bounded(sample.kind, sample.value) });
}

/** Las muestras que caben en un cuerpo (en orden: las más antiguas primero). */
function fitting(batch: PerfSample[]): PerfSample[] {
  let size = 0;
  const kept: PerfSample[] = [];
  for (const sample of batch) {
    size += JSON.stringify(sample).length + 1;
    if (size > MAX_BODY_CHARS) break;
    kept.push(sample);
  }
  return kept;
}

/** Envía lo medido (si hay algo) y vacía el búfer. Nunca lanza ni avisa nada a la persona. */
export function flush(): void {
  if (!samples.length) return;
  const batch = fitting(samples);
  samples = [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': currentLocale(),
    // Igual que apiClient: evita la página intermedia de ngrok (plan gratuito) en desarrollo.
    'ngrok-skip-browser-warning': 'true',
  };
  // Con sesión, el backend acepta todo (con su límite por sesión); sin ella, solo lo del inicio de sesión.
  const token = currentAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), config.perf.timeoutMs);
  void fetch(buildUrl(TELEMETRY_PATH), {
    method: 'POST',
    keepalive: true,
    headers,
    body: JSON.stringify({ app_version: config.buildId.slice(0, 64), samples: batch }),
    signal: controller.signal,
  })
    // Mejor esfuerzo: si no llega (sin red, servidor saturado, 429) se descarta; medir nunca molesta a la persona.
    .catch(() => undefined)
    .finally(() => window.clearTimeout(timer));
}

/** Muestras en espera (para las pruebas). */
export function pendingSamples(): readonly PerfSample[] {
  return samples;
}

/** Vacía el búfer sin enviarlo (para las pruebas). */
export function clearSamples(): void {
  samples = [];
}
