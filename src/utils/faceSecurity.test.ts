import { describe, expect, it } from 'vitest';
import type { FaceSecurityOverview } from '../types/faceSecurity';
import { flashReadiness, formatThreshold } from './faceSecurity';

const base: FaceSecurityOverview = {
  autocalibration: true,
  window_days: 30,
  min_samples: 300,
  interval_hours: 6,
  thresholds: [{ key: 'FLASH_SCORE', name: 'Respuesta mínima al destello', value: 0.35, floor: 0.35, cap: 0.75, samples: 0, computed_at: null, raised: false }],
  escalation_min_attacks: 5,
  escalation_window_minutes: 30,
  reinforced: [],
  flash: { measured: 400, conclusive: 380, inconclusive: 20, score_median: 0.7, score_p10: 0.4, magnitude_median: 0.02 },
};

describe('seguridad facial: presentación pura', () => {
  it('umbrales legibles: hasta 3 decimales; acercarse en veces; sin valor, guion', () => {
    expect(formatThreshold('LIVENESS_YAW', 0.21)).toBe('0.21');
    expect(formatThreshold('ANTISPOOF_REAL', 0.123456)).toBe('0.123');
    expect(formatThreshold('LIVENESS_CLOSER', 1.3)).toBe('×1.3');
    expect(formatThreshold('FLASH_SCORE', null)).toBe('—');
  });

  it('el destello se puede exigir con mediciones suficientes, buena respuesta y poca luz directa', () => {
    expect(flashReadiness(base)).toEqual({ ready: true, pending: [] });
    expect(flashReadiness({ ...base, flash: { ...base.flash, score_p10: 0.35 } }).ready).toBe(true); // justo en el umbral
  });

  it('dice qué falta: mediciones, respuesta del 10 % más bajo y luz', () => {
    const early = flashReadiness({ ...base, flash: { measured: 0, conclusive: 0, inconclusive: 0, score_median: null, score_p10: null, magnitude_median: null } });
    expect(early.ready).toBe(false);
    expect(early.pending).toEqual(['Reunir 300 mediciones concluyentes (van 0).', 'Que el 10 % con menor respuesta supere 0.35 (hoy —).']);
    const sunny = flashReadiness({ ...base, flash: { ...base.flash, inconclusive: 100, score_p10: 0.2 } });
    expect(sunny.pending).toEqual(['Que el 10 % con menor respuesta supere 0.35 (hoy 0.2).', 'Menos mediciones con demasiada luz: hoy 25 % (máximo 10 %).']);
    // Sin el umbral del destello en la lista (servidor anterior) no se recomienda exigirlo.
    expect(flashReadiness({ ...base, thresholds: [] }).pending).toEqual(['Que el 10 % con menor respuesta supere — (hoy 0.4).']);
  });
});
