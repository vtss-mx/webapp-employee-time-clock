import type { CheckpointProfile, Validator, VerificationPolicy, VerificationResult } from '../types';
import { STRICT_RULES } from '../hooks/useVerificationPolicy';

export const sampleValidator: Validator = {
  id: 3,
  name: 'Recepción planta 1',
  email: 'recepcion@empresa.com',
  mode: 'QR_OR_FACE',
  active: true,
  last_login_at: null,
  identifications_today: 0,
  created_at: '2026-10-01T00:00:00Z',
  address: {
    street: 'Calle Dr. Paliza',
    exterior_number: '71',
    interior_number: null,
    postal_code: '83000',
    country_code: 'MX',
    state: 'Sonora',
    municipality: 'Hermosillo',
    city: 'Hermosillo',
    latitude: 29.0729,
    longitude: -110.9559,
  },
  location_required: false,
  location_radius_m: null,
  devices_pending: 0,
  devices_approved: 1,
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
  ...STRICT_RULES,
  blocked_cameras: ['virtual', 'manycam', 'obs virtual'],
  min_confidence: 0.99999,
  identify_confidence: 0.99999,
  min_capture_quality: 0.4,
  max_location_accuracy_m: 100,
  detect_impossible_travel: true,
  max_travel_kmh: 200,
  liveness_timeout_seconds: 60,
  flash_liveness: 'OBSERVE',
  updated_at: null,
  updated_by: null,
};
