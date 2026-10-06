import { describe, expect, it } from 'vitest';
import type { FaceSecurityOverview } from '../types/faceSecurity';
import { flashReadiness, formatMs, formatThreshold, protocolReadiness } from './faceSecurity';

const base: FaceSecurityOverview = {
  autocalibration: true,
  window_days: 30,
  min_samples: 300,
  interval_hours: 6,
  thresholds: [{ key: 'FLASH_SCORE', name: 'Respuesta mínima al destello', value: 0.35, floor: 0.35, cap: 0.75, samples: 0, computed_at: null, raised: false }],
  escalation_min_attacks: 5,
  escalation_window_minutes: 30,
  reinforced: [],
  flash: { measured: 400, conclusive: 380, inconclusive: 20, score_median: 0.7, score_p10: 0.4, magnitude_median: 0.02, ratio_median: 1.9, ratio_p10: 1.5 },
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
    const early = flashReadiness({ ...base, flash: { measured: 0, conclusive: 0, inconclusive: 0, score_median: null, score_p10: null, magnitude_median: null, ratio_median: null, ratio_p10: null } });
    expect(early.ready).toBe(false);
    expect(early.pending).toEqual(['Reunir 300 mediciones concluyentes (van 0).', 'Que el 10 % con menor respuesta supere 0.35 (hoy —).']);
    const sunny = flashReadiness({ ...base, flash: { ...base.flash, inconclusive: 100, score_p10: 0.2 } });
    expect(sunny.pending).toEqual(['Que el 10 % con menor respuesta supere 0.35 (hoy 0.2).', 'Menos mediciones con demasiada luz: hoy 25 % (máximo 10 %).']);
    // Sin el umbral del destello en la lista (servidor anterior) no se recomienda exigirlo.
    expect(flashReadiness({ ...base, thresholds: [] }).pending).toEqual(['Que el 10 % con menor respuesta supere — (hoy 0.4).']);
  });
});

describe('seguridad facial: protocolo de captura (antifraude 2a)', () => {
  const protocol = {
    flash_attempts: 400,
    paced: 390,
    late: 5,
    pace_p50_ms: 640,
    pace_p95_ms: 1200,
    window_ms: 2000,
    liveness_attempts: 400,
    bursts: 396,
    pulse_measured: 380,
    pulse_seen: 250,
    pulse_median_snr: 0.4,
  };

  it('el moiré se lee en dB y los tiempos en ms', () => {
    expect(formatThreshold('MOIRE', 14.1176)).toBe('14.1 dB');
    expect([formatMs(640.4), formatMs(null)]).toEqual(['640 ms', '—']);
  });

  it('se puede exigir cuando casi todo está dictado, a tiempo y con ráfaga', () => {
    expect(protocolReadiness({ ...base, protocol })).toEqual({ ready: true, pending: [] });
    expect(protocolReadiness(base)).toEqual({ ready: false, pending: [] }); // un servidor sin el protocolo
  });

  it('dice qué falta: destellos dictados, proporción dictada, a tiempo y con ráfaga', () => {
    const early = protocolReadiness({ ...base, protocol: { ...protocol, flash_attempts: 0, paced: 0, late: 0, liveness_attempts: 0, bursts: 0 } });
    expect(early.pending).toEqual([
      'Reunir 300 destellos dictados (van 0).',
      'Que al menos el 95 % de los destellos sea dictado (hoy 0 %).',
      'Que al menos el 95 % de los intentos traiga ráfaga (hoy 0 %).',
    ]);
    const slow = protocolReadiness({ ...base, protocol: { ...protocol, paced: 360, late: 40, bursts: 300 } });
    expect(slow.pending).toEqual([
      'Que al menos el 95 % de los destellos sea dictado (hoy 90 %).',
      'Menos respuestas fuera de tiempo: hoy 11.1 % (máximo 5 %).',
      'Que al menos el 95 % de los intentos traiga ráfaga (hoy 75 %).',
    ]);
  });
});
