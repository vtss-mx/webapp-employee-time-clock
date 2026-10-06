import { t } from '../i18n';
import type { FaceSecurityOverview } from '../types/faceSecurity';
import { formatCount, formatNumber, formatRate } from './numbers';

/*
 * Presentación pura de la seguridad facial de la plataforma (pantalla del ADMIN "Seguridad facial").
 */

/** Umbrales que se miden en "veces" (acercarse a la cámara): ×1.25. */
const SCALE_KEYS: ReadonlySet<string> = new Set(['LIVENESS_CLOSER']);
/** Umbrales en decibeles (el moiré del antifraude 2a): "14.1 dB" (la unidad es la misma en los dos idiomas). */
const DECIBEL_KEYS: ReadonlySet<string> = new Set(['MOIRE']);

/** Valor de un umbral legible: hasta 3 decimales; acercarse, en veces ("×1.25"); el moiré, en dB. */
export function formatThreshold(key: string, value: number | null): string {
  if (value === null) return '—';
  const number = formatNumber(value, 3);
  if (DECIBEL_KEYS.has(key)) return `${formatNumber(value, 1)} dB`;
  return SCALE_KEYS.has(key) ? `×${number}` : number;
}

/** Un tiempo en milisegundos ("640 ms"; la unidad es la misma en los dos idiomas). */
export const formatMs = (value: number | null): string => (value === null ? '—' : `${formatNumber(value, 0)} ms`);

/** Proporción máxima de mediciones con demasiada luz ambiente para exigir el destello. */
export const FLASH_MAX_INCONCLUSIVE = 0.1;

export interface FlashReadiness {
  ready: boolean;
  /** Lo que falta, en el idioma activo (vacío si ya se puede exigir). */
  pending: string[];
}

/**
 * ¿Ya se puede exigir el destello (modo «Obligatorio») sin dejar fuera a personas reales? Cuando hay
 * suficientes mediciones concluyentes (las mismas que pide la autocalibración), el 10 % de las
 * personas con menor respuesta supera el umbral vigente y pocas mediciones tuvieron demasiada luz.
 */
export function flashReadiness({ flash, min_samples, thresholds }: FaceSecurityOverview): FlashReadiness {
  const required = thresholds.find((t) => t.key === 'FLASH_SCORE')?.value ?? null;
  const pending: string[] = [];
  if (flash.conclusive < min_samples) {
    pending.push(t('faceSecurity.flash.pending.samples', { required: formatCount(min_samples), current: formatCount(flash.conclusive) }));
  }
  if (flash.score_p10 === null || required === null || flash.score_p10 < required) {
    pending.push(
      t('faceSecurity.flash.pending.score', { required: formatThreshold('FLASH_SCORE', required), current: formatThreshold('FLASH_SCORE', flash.score_p10) }),
    );
  }
  const bright = flash.measured ? flash.inconclusive / flash.measured : 0;
  if (bright > FLASH_MAX_INCONCLUSIVE) {
    pending.push(t('faceSecurity.flash.pending.bright', { current: formatRate(Math.round(bright * 100)), max: formatRate(FLASH_MAX_INCONCLUSIVE * 100) }));
  }
  return { ready: pending.length === 0, pending };
}

/** Proporción mínima de destellos dictados y de intentos con ráfaga, y máxima de respuestas fuera de tiempo, para exigir
 * el protocolo de captura sin dejar fuera a personas reales (redes que bloquean el canal en vivo, teléfonos lentos). */
export const PROTOCOL_MIN_SHARE = 0.95;
export const PROTOCOL_MAX_LATE = 0.05;

const percent = (share: number) => formatRate(Math.round(share * 1000) / 10);

/**
 * ¿Ya se puede exigir el protocolo de captura (antifraude 2a: señales «Destello sin dictar» y «Sin ráfaga»)? Cuando
 * hay suficientes destellos dictados (las mismas mediciones que pide la autocalibración), casi todos los destellos
 * fueron dictados, casi ninguno llegó fuera de tiempo y casi todos los intentos con prueba de vida trajeron ráfaga.
 * Sin datos del protocolo (un servidor anterior), no hay nada que exigir.
 */
export function protocolReadiness({ protocol, min_samples }: FaceSecurityOverview): FlashReadiness {
  if (!protocol) return { ready: false, pending: [] };
  const pending: string[] = [];
  if (protocol.paced < min_samples) {
    pending.push(t('faceSecurity.protocol.pending.samples', { required: formatCount(min_samples), current: formatCount(protocol.paced) }));
  }
  const paced = protocol.flash_attempts ? protocol.paced / protocol.flash_attempts : 0;
  if (paced < PROTOCOL_MIN_SHARE) pending.push(t('faceSecurity.protocol.pending.paced', { min: percent(PROTOCOL_MIN_SHARE), current: percent(paced) }));
  const late = protocol.paced ? protocol.late / protocol.paced : 0;
  if (late > PROTOCOL_MAX_LATE) pending.push(t('faceSecurity.protocol.pending.late', { current: percent(late), max: percent(PROTOCOL_MAX_LATE) }));
  const bursts = protocol.liveness_attempts ? protocol.bursts / protocol.liveness_attempts : 0;
  if (bursts < PROTOCOL_MIN_SHARE) pending.push(t('faceSecurity.protocol.pending.bursts', { min: percent(PROTOCOL_MIN_SHARE), current: percent(bursts) }));
  return { ready: pending.length === 0, pending };
}
