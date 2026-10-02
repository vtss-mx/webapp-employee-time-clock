import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { VerificationPolicy } from '../types';

/** Valores seguros mientras carga o si no hay red: se asume lo más estricto. */
export const STRICT_POLICY: VerificationPolicy = {
  block_glasses: true,
  block_headwear: true,
  block_mask: true,
  liveness_challenge: true,
  anti_spoofing: true,
  qr_enabled: true,
  employee_mobile_only: true,
  validator_mobile_only: true,
  min_confidence: 0.99999,
  updated_at: null,
  updated_by: null,
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

/** Política de verificación de la empresa (compartida entre pantallas, una sola petición). */
export function useVerificationPolicy(): { policy: VerificationPolicy; loaded: boolean } {
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

  return { policy: policy ?? STRICT_POLICY, loaded: policy !== null };
}

/** Solo para pruebas. */
export function resetPolicyCache(): void {
  cached = null;
  inflight = null;
}
