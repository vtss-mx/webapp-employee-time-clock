import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { VerificationPolicy, VerificationRules } from '../types';

/**
 * Valores seguros mientras carga o si no hay red: se asume lo más estricto. Sin umbral de
 * confianza: solo lo evalúa el servidor y lo edita Configuración con la política cargada.
 */
export const STRICT_RULES: VerificationRules = {
  block_glasses: true,
  block_headwear: true,
  block_mask: true,
  liveness_challenge: true,
  anti_spoofing: true,
  qr_enabled: true,
  employee_mobile_only: true,
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
