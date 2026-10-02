import type { CheckpointProfile, Validator, VerificationPolicy, VerificationResult } from '../types';

export const sampleValidator: Validator = {
  id: 3,
  name: 'Recepción planta 1',
  email: 'recepcion@empresa.com',
  mode: 'QR_OR_FACE',
  active: true,
  last_login_at: null,
  identifications_today: 0,
  created_at: '2026-10-01T00:00:00Z',
};

export const sampleCheckpoint: CheckpointProfile = {
  id: 3,
  name: 'Recepción planta 1',
  mode: 'QR_OR_FACE',
  company: { id: 1, name: 'Mi empresa', active: true },
  liveness_required: true,
  qr_enabled: true,
};

export const identifiedResult: VerificationResult = {
  verified: true,
  method: 'FACE',
  message: 'Identificación exitosa',
  employee_id: 7,
  employee_number: 'EMP-7',
  name: 'Ana Ruiz',
  confidence: 0.9999,
  verified_at: '2026-10-01T10:00:00Z',
};

/** Política de la empresa como la devuelve GET /api/settings/verification (lo más estricto). */
export const samplePolicy: VerificationPolicy = {
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
