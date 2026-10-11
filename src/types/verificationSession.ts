/** Progreso técnico; consultar esta metadata nunca concede una verificación. */
export interface VerificationSession {
  id: string;
  execution_status: 'READY' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  decision_status: string | null;
  created_at: string;
  expires_at: string;
  flow_version: string;
  policy_version: string;
  attempt_id: number | null;
  device_nonce: string | null;
}
