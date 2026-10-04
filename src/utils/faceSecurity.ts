import type { FaceSecurityOverview } from '../types/faceSecurity';

/*
 * Presentación pura de la seguridad facial de la plataforma (pantalla del ADMIN "Seguridad facial").
 */

/** Umbrales que se miden en "veces" (acercarse a la cámara): ×1.25. */
const SCALE_KEYS: ReadonlySet<string> = new Set(['LIVENESS_CLOSER']);

/** Valor de un umbral legible: hasta 3 decimales; acercarse, en veces ("×1.25"). */
export function formatThreshold(key: string, value: number | null): string {
  if (value === null) return '—';
  const number = value.toLocaleString('es-MX', { maximumFractionDigits: 3 });
  return SCALE_KEYS.has(key) ? `×${number}` : number;
}

/** Proporción máxima de mediciones con demasiada luz ambiente para exigir el destello. */
export const FLASH_MAX_INCONCLUSIVE = 0.1;

export interface FlashReadiness {
  ready: boolean;
  /** Lo que falta (vacío si ya se puede exigir). */
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
  if (flash.conclusive < min_samples) pending.push(`Reunir ${min_samples} mediciones concluyentes (van ${flash.conclusive}).`);
  if (flash.score_p10 === null || required === null || flash.score_p10 < required) {
    pending.push(`Que el 10 % con menor respuesta supere ${formatThreshold('FLASH_SCORE', required)} (hoy ${formatThreshold('FLASH_SCORE', flash.score_p10)}).`);
  }
  const bright = flash.measured ? flash.inconclusive / flash.measured : 0;
  if (bright > FLASH_MAX_INCONCLUSIVE) pending.push(`Menos mediciones con demasiada luz: hoy ${Math.round(bright * 100)} % (máximo ${FLASH_MAX_INCONCLUSIVE * 100} %).`);
  return { ready: pending.length === 0, pending };
}
