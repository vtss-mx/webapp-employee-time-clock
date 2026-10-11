import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { VerificationPolicy, VerificationRules } from '../types';
import { DEFAULT_ENROLLMENT_STEPS } from '../utils/enrollmentStepRules';

/**
 * Valores seguros mientras carga o si no hay red: se asume lo más estricto. Sin umbrales de
 * confianza ni de calidad: solo los evalúa el servidor (los configura el ADMIN en la política).
 */
export const STRICT_RULES: VerificationRules = {
  block_glasses: false, // apagado por omisión (decisión del dueño, 2026-10-07); el ADMIN lo enciende por empresa
  block_headwear: true,
  block_mask: true,
  liveness_challenge: true,
  anti_spoofing: true,
  qr_enabled: true,
  validator_mobile_only: true,
  anti_spoofing_level: 'STANDARD',
  liveness_steps: 2,
  block_virtual_cameras: true,
  reject_foreign_images: true,
  detect_static_captures: true,
  detect_replays: true,
  check_capture_continuity: true,
  enforce_human_timing: true,
  detect_duplicate_faces: true,
  lockout_enabled: true,
  lockout_max_failures: 5,
  lockout_minutes: 15,
  validator_device_approval: true,
  qr_lifetime_seconds: 30,
  adaptive_learning: true,
  // Registro facial con las preguntas en video (decisión del dueño, 2026-10-06): lo más estricto mientras carga.
  voice_verification: true,
  // Guía por voz del registro (decisión del dueño, 2026-10-08): es NEUTRAL, no un candado; mientras carga se asume
  // apagada (no se dicta nada hasta conocer la política real de la empresa). El perfil por omisión del contrato.
  voice_guidance_enabled: false,
  voice_profile: 'FEMALE_WARM',
  // Pasos del registro de identidad (decisión del dueño, 2026-10-08): mientras carga se asume el flujo por omisión del
  // backend (`DEFAULT_ENROLLMENT_STEPS`), el mismo que pedía el registro antes de volverse configurable.
  enrollment_steps: [...DEFAULT_ENROLLMENT_STEPS],
  // Ubicación de la verificación: a diferencia de los candados no se puede "asumir estricta" (ENFORCE) mientras carga,
  // porque eso abriría el aviso nativo de ubicación antes de conocer el modo real de la empresa. Se asume OFF (no se
  // pide) hasta que llega la política; una vez cargada rige el modo real y el servidor es quien exige en ENFORCE.
  verification_location: 'OFF',
  // Sin la lista del servidor no se bloquea ninguna en pantalla (el backend la exige igual).
  blocked_cameras: [],
};

const EVENT = 'tc:policy-changed';
let cached: VerificationPolicy | null = null;
let inflight: Promise<VerificationPolicy> | null = null;

/** Publica una política recién guardada (pantalla de Configuración) a toda la app. */
export function publishPolicy(policy: VerificationPolicy): void {
  cached = policy;
  window.dispatchEvent(new CustomEvent<VerificationPolicy>(EVENT, { detail: policy }));
}

function loadPolicy(): Promise<VerificationPolicy> {
  inflight ??= settingsService
    .getVerificationPolicy()
    .then((policy) => {
      cached = policy;
      return policy;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Reglas de la política de verificación de la empresa (compartida entre pantallas, una sola petición). */
export function useVerificationPolicy(): { policy: VerificationRules; loaded: boolean } {
  const [policy, setPolicy] = useState<VerificationPolicy | null>(cached);

  useEffect(() => {
    let active = true;
    loadPolicy()
      .then((next) => active && setPolicy(next))
      .catch(() => undefined); // sin red: se usan los valores estrictos
    const onChange = (event: Event) => setPolicy((event as CustomEvent<VerificationPolicy>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  return { policy: policy ?? STRICT_RULES, loaded: policy !== null };
}

/** Solo para pruebas. */
export function resetPolicyCache(): void {
  cached = null;
  inflight = null;
}
