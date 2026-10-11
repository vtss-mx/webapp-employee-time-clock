/**
 * Rutas de la empresa, del validador y del empleado en el backend falso (ver `core.ts`).
 */
import type { ApiKey, CheckpointEvent, CompanyVerification, DeviceSession, EmployeeDevice, EmployeeQrSummary, FaceEnrollmentDetail, Kiosk, SigningKey, SigningKeyList, ValidatorDevice, VerificationLog } from '../../types';
import type { Passkey } from '../../types/passkeys';
import type { EmployeeDocument } from '../../types/employeeDocuments';
import { taxCertificate } from '../documents';
import { sampleCheckpoint, samplePolicy, sampleValidator, sampleVerificationDetail, sampleVerificationSummary } from '../fixtures';
import { plant } from '../sites';
import { get, pageOf, route, say, tx, type Ctx, type Route } from './core';
import { person } from './people';

const enrollment = (): FaceEnrollmentDetail => ({
  id: 1,
  status: 'PENDING',
  employee_id: 7,
  employee_number: 'EMP-7',
  full_name: 'Ana Ruiz',
  email: 'ana@acme.mx',
  birth_date: '1990-01-01',
  employee_active: true,
  samples: 5,
  quality_score: 0.92,
  liveness_passed: true,
  flagged_accessories: ['GLASSES'],
  submitted_at: '2026-10-05T10:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  rejection_reason: null,
  photo: null,
  similar: [],
  voice: null,
});

/** El nombre de un dispositivo lo arma el backend: el modelo (nombre propio) o su tipo en el idioma de la petición. */
const device = (ctx: Ctx): EmployeeDevice => ({ id: 1, name: tx(ctx, say({ 'es-MX': 'Teléfono', 'en-US': 'Phone', 'pt-BR': 'Telefone', 'fr-FR': 'Téléphone', 'de-DE': 'Telefon', 'it-IT': 'Telefono', 'es-ES': 'Teléfono' })), status: 'APPROVED', first_seen_at: '2026-10-01T10:00:00Z', last_seen_at: '2026-10-05T10:00:00Z', uses: 12, stepped_up_at: null, reviewed_at: null, reviewed_by: null });

const validatorDevice: ValidatorDevice = { id: 1, name: 'iPad Acme', user_agent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', status: 'PENDING', created_at: '2026-10-01T10:00:00Z', last_seen_at: '2026-10-05T10:00:00Z', last_ip: '187.188.1.10', reviewed_at: null, reviewed_by: null };

const apiKey: ApiKey = { id: 1, name: 'Nómina Acme', prefix: 'tck_Ab3dE9fG', scopes: ['EMPLOYEES_READ'], status: 'ACTIVE', created_at: '2026-10-01T10:00:00Z', created_by: 'admin@acme.mx', expires_at: '2027-04-01T10:00:00Z', days_to_expire: 180, expiring_soon: false, last_used_at: null, last_used_ip: null, revoked_at: null, revoked_by: null };

/**
 * Clave de FIRMA de la empresa (migración 0105): su huella y su clave pública llevan dígitos, así que no son
 * palabras de ningún idioma (el revisor del idioma las deja pasar). Las REGLAS (`limits`) las envía el servidor:
 * la pantalla no lleva escrito ninguno de esos números (regla 25 de la raíz).
 */
const signingKey: SigningKey = {
  id: 1,
  label: 'Firma Acme',
  fingerprint: '3b1f7d90a4c25e68b0d14f73a9c82e5106bd4f37c91a8e02d5b6473fa1c80e92',
  public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9pL0c4fQ2b1mN7v5R8sT3uW6xY0zA1B2C3D4E5F6g7H8i9J0kL1mN2oP3qR4sT5uV6wX7yZ8a9B0c1D2e3F4g5==',
  algorithm: 'ES256',
  generated: false,
  status: 'ACTIVE',
  created_at: '2026-10-01T10:00:00Z',
  created_by: 'admin@acme.mx',
  expires_at: '2027-10-01T10:00:00Z',
  days_to_expire: 365,
  expiring_soon: false,
  revoked_at: null,
  revoked_by: null,
  last_used_at: '2026-10-05T10:00:00Z',
};

const signingKeys = (): SigningKeyList => ({
  items: [signingKey],
  total: 1,
  page: 1,
  size: 10,
  platform: {
    configured: true,
    fingerprint: 'c70e4a1826fb5d03941e7c6ab2850f39d1476be02a85c3f914d60b7e285a3f41',
    public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9s0T1u2V3w4X5y6Z7a8B9c0D1e2F3g4H5i==',
    algorithm: 'ES256',
  },
  limits: { active: 1, max_active: 5, default_days: 365, max_days: 730, grace_days: 7 },
});

const kiosk: Kiosk = { id: 1, site_id: 1, name: 'Entrada Acme', paired: true, paired_at: '2026-10-01T10:00:00Z', device_name: 'iPad · Safari', last_seen_at: '2026-10-05T10:00:00Z', pairing_expires_at: null, created_at: '2026-10-01T10:00:00Z' };

const verification: VerificationLog = { id: 1, method: 'FACE', success: false, score: 0.42, reason: 'NO_MATCH', ip_address: '187.188.1.10', created_at: '2026-10-05T10:00:00Z' };
const companyVerification: CompanyVerification = { id: 1, created_at: '2026-10-05T10:00:00Z', method: 'FACE', success: true, reason: null, confidence: 0.99, employee_id: 7, employee_number: 'EMP-7', employee_name: 'Ana Ruiz', avatar: null, latitude: 29.1, longitude: -110.9, location_accuracy_m: 12 };

const checkpointEvent: CheckpointEvent = { id: 1, created_at: '2026-10-05T10:00:00Z', method: 'QR', success: true, reason: null, confidence: null, employee_name: 'Ana Ruiz', employee_number: 'EMP-7' };

const qrSummary: EmployeeQrSummary = { live: false, live_until: null, last_issued_at: '2026-10-05T10:00:00Z', last_used_at: '2026-10-05T10:01:00Z' };

// Documentos de identidad del empleado (onboarding con OCR): un documento con sus datos leídos (texto de la persona, no
// traducible) y lo que pide la empresa. El número y los datos son los mismos en todos los idiomas.
const employeeDoc: EmployeeDocument = {
  id: 1,
  employee_id: 7,
  type: 'NATIONAL_ID',
  file_name: 'ine.jpg',
  content_type: 'image/jpeg',
  size: 480000,
  uploaded_by: 'ana@acme.mx',
  uploaded_by_employee: true,
  uploaded_at: '2026-10-05T10:00:00Z',
  ocr_processed: true,
  ocr_confidence: 0.91,
  mrz_verified: false,
  confirmed: false,
  confirmed_by: null,
  confirmed_at: null,
  can_delete: true,
  deleted_at: null,
  deleted_by: null,
  data: { full_name: 'Ana Ruiz', document_number: 'PEXJ900510HSRRNN09', birth_date: '1990-05-10', expiry_date: null, nationality: 'MEX', sex: 'M', curp: 'PEXJ900510HSRRNN09', voter_key: null, postal_code: '83000', address: null },
};
const deviceSession: DeviceSession = { id: 'sid-1', created_at: '2026-10-01T10:00:00Z', last_used_at: '2026-10-05T10:00:00Z', expires_at: '2026-10-08T10:00:00Z', ip_address: '187.188.1.10', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', current: true };
const passkey: Passkey = { id: 1, name: 'Mi teléfono', created_at: '2026-10-01T10:00:00Z', last_used_at: '2026-10-05T08:00:00Z', transports: ['internal'], backed_up: true };

export function companyRoutes(): Route[] {
  return [
    // Contadores del menú.
    get('/enrollments', () => pageOf([enrollment()])),
    // Empleados.
    get('/employees', () => pageOf([person(7), person(8, { first_name: 'Luis', last_name: 'Paz', full_name: 'Luis Paz', email: 'luis@acme.mx', employee_number: null, face_status: 'NOT_ENROLLED', active: false })])),
    get('/employees/:id', () => person(1)),
    get('/employees/:id/qr', () => qrSummary),
    get('/employees/:id/verifications', () => pageOf([verification])),
    // Historial de verificaciones de la empresa (migración 0106): su resumen, su página con el periodo y el detalle.
    get('/verifications/summary', () => sampleVerificationSummary),
    get('/verifications/:id', () => ({ ...sampleVerificationDetail, company_id: null, company_name: null })),
    get('/verifications', () => pageOf([companyVerification], { since: sampleVerificationSummary.since, until: sampleVerificationSummary.until, count_cap: 10000 })),
    get('/employees/:id/devices', (ctx) => pageOf([device(ctx)])),
    // Puntos de verificación y sus kioscos.
    get('/sites', () => pageOf([plant])),
    get('/sites/:id', () => plant),
    get('/sites/:id/kiosks', () => pageOf([kiosk])),
    // Validaciones, validadores, integraciones y documentos.
    get('/enrollments/:id', () => enrollment()),
    get('/validators', () => ({ ...pageOf([sampleValidator]), active: 1, limit: 5 })),
    get('/validators/:id', () => sampleValidator),
    get('/validators/:id/devices', () => pageOf([validatorDevice])),
    get('/api-keys', () => pageOf([apiKey])),
    // Claves de firma de la empresa (sección de Integraciones) con la clave pública de la plataforma y sus reglas.
    get('/api-keys/signing-keys', () => signingKeys()),
    get('/documents', () => pageOf([taxCertificate])),
    // Expediente de documentos del empleado que revisa la empresa (sección del registro facial).
    get('/validations/employees/:id/documents', () => pageOf([employeeDoc])),
    // Política (la empresa la lee; también el empleado y el validador).
    get('/settings/verification', () => samplePolicy),
    // Validador.
    get('/checkpoint/me', () => sampleCheckpoint),
    get('/checkpoint/recent', () => pageOf([checkpointEvent])),
    // Empleado.
    // El registro facial en tres pasos (decisión del dueño, 2026-10-07): la foto hecha y las capturas por hacer.
    // El flujo de registro de identidad de la empresa (decisión del dueño, 2026-10-08): sus pasos, en su orden.
    get('/enrollment/progress', () => ({
      face_status: 'NOT_ENROLLED',
      complete: false,
      current: 'FACE_CAPTURES',
      steps: [
        { code: 'OFFICIAL_ID', position: 1, status: 'done', blocked_by: null, done_at: '2026-10-05T10:00:00Z', expires_at: null, answered: null, total: null, attempts_left: null, document_types: ['PASSPORT', 'NATIONAL_ID', 'DRIVER_LICENSE', 'OTHER_OFFICIAL_ID'], document_id: 1 },
        { code: 'INITIAL_PHOTO', position: 2, status: 'done', blocked_by: null, done_at: '2026-10-07T15:00:00Z', expires_at: '2026-10-10T15:00:00Z', answered: null, total: null, attempts_left: null, document_types: [], document_id: null },
        { code: 'FACE_CAPTURES', position: 3, status: 'pending', blocked_by: null, done_at: null, expires_at: null, answered: null, total: null, attempts_left: null, document_types: [], document_id: null },
        { code: 'VOICE_VIDEO', position: 4, status: 'blocked', blocked_by: 'FACE_CAPTURES', done_at: null, expires_at: null, answered: 0, total: 3, attempts_left: 9, document_types: [], document_id: null },
      ],
    })),
    // Documentos de identidad: los pasos `OFFICIAL_ID` y `PROOF_OF_ADDRESS` del registro usan estos endpoints.
    get('/me/documents', () => pageOf([employeeDoc])),
    get('/users/me/devices', (ctx) => pageOf([device(ctx)])),
    route('POST', '/users/me/qr', () => ({ id: 1, employee_number: 'EMP-7', created_at: '2026-10-06T15:00:00Z', expires_at: '2030-10-06T15:01:00Z', lifetime_seconds: 60, content: 'TC-QR:abc' }), true),
    get('/users/me/qr/:id', () => ({ id: 1, status: 'ACTIVE', expires_at: '2030-10-06T15:01:00Z', used_at: null })),
    // Cuenta y validación en vivo (el respaldo HTTP del canal: su mensaje en el idioma de la petición).
    get('/auth/sessions', () => pageOf([deviceSession])),
    // Llaves de acceso (WebAuthn) de la cuenta (Mi perfil).
    get('/auth/passkeys', () => pageOf([passkey])),
    get('/validation', (ctx) => ({ field: ctx.query.get('field') ?? 'email', value: ctx.query.get('value') ?? '', normalized: null, valid: true, available: true, code: 'AVAILABLE', message: tx(ctx, say({ 'es-MX': 'Disponible', 'en-US': 'Available', 'pt-BR': 'Disponível', 'fr-FR': 'Disponible', 'de-DE': 'Verfügbar', 'it-IT': 'Disponibile', 'es-ES': 'Disponible' })) })),
  ];
}
