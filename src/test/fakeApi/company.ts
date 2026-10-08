/**
 * Rutas de la empresa, del validador y del empleado en el backend falso (ver `core.ts`).
 */
import type { ApiKey, AttendanceBoard, CheckpointEvent, CompanyVerification, DeviceSession, EmployeeDevice, EmployeeQrSummary, FaceEnrollmentDetail, Kiosk, ValidatorDevice, VerificationLog } from '../../types';
import type { Passkey } from '../../types/passkeys';
import type { EmployeeDocument, EmployeeDocumentRequirements } from '../../types/employeeDocuments';
import { taxCertificate } from '../documents';
import { production } from '../departments';
import { sampleCheckpoint, samplePolicy, sampleValidator } from '../fixtures';
import { morning, plant, weekend } from '../shifts';
import { get, pageOf, route, say, tx, type Ctx, type Route } from './core';
import { absence, holidays, person, ref, session, sessionDetail, shiftRequest, today, workday } from './people';

const department = { ...production, id: 1, name: 'Operaciones Acme', description: 'Equipo Acme' };

const board = (ctx: Ctx): AttendanceBoard => ({
  items: [
    { employee: ref, department: 'Operaciones Acme', shift_name: 'Turno Acme', scheduled_start: session.scheduled_start, scheduled_end: session.scheduled_end, state: 'DONE', session },
    {
      employee: { id: 8, full_name: 'Luis Paz', employee_number: 'EMP-8' },
      department: null,
      shift_name: 'Turno Acme',
      scheduled_start: session.scheduled_start,
      scheduled_end: session.scheduled_end,
      state: 'DAY_OFF',
      session: null,
      day_off: { kind: 'VACATION', name: tx(ctx, say({ 'es-MX': 'Vacaciones', 'en-US': 'Vacation', 'pt-BR': 'Férias', 'fr-FR': 'Congés', 'de-DE': 'Urlaub', 'it-IT': 'Ferie', 'es-ES': 'Vacaciones' })), work_date: '2026-10-05', starts_on: '2026-10-05', ends_on: '2026-10-07' },
    },
  ],
  total: 2,
  page: 1,
  size: 10,
  work_date: '2026-10-05',
  working: 0,
  on_break: 0,
  done: 1,
  missed_checkout: 0,
  day_off: 1,
});

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

const apiKey: ApiKey = { id: 1, name: 'Nómina Acme', prefix: 'tck_Ab3dE9fG', scopes: ['EMPLOYEES_READ'], status: 'ACTIVE', created_at: '2026-10-01T10:00:00Z', created_by: 'admin@acme.mx', expires_at: null, last_used_at: null, last_used_ip: null, revoked_at: null, revoked_by: null };

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
  deleted_at: null,
  deleted_by: null,
  data: { full_name: 'Ana Ruiz', document_number: 'PEXJ900510HSRRNN09', birth_date: '1990-05-10', expiry_date: null, nationality: 'MEX', sex: 'M', curp: 'PEXJ900510HSRRNN09', voter_key: null, postal_code: '83000', address: null },
};
const documentRequirements: EmployeeDocumentRequirements = {
  required: true,
  types: [
    { code: 'PASSPORT', category: 'OFFICIAL_ID' },
    { code: 'NATIONAL_ID', category: 'OFFICIAL_ID' },
    { code: 'DRIVER_LICENSE', category: 'OFFICIAL_ID' },
    { code: 'OTHER_OFFICIAL_ID', category: 'OFFICIAL_ID' },
    { code: 'PROOF_OF_ADDRESS', category: 'PROOF_OF_ADDRESS' },
  ],
  documents: [employeeDoc],
  needs_official_id: false,
  needs_proof_of_address: true,
};

const deviceSession: DeviceSession = { id: 'sid-1', created_at: '2026-10-01T10:00:00Z', last_used_at: '2026-10-05T10:00:00Z', expires_at: '2026-10-08T10:00:00Z', ip_address: '187.188.1.10', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', current: true };
const passkey: Passkey = { id: 1, name: 'Mi teléfono', created_at: '2026-10-01T10:00:00Z', last_used_at: '2026-10-05T08:00:00Z', transports: ['internal'], backed_up: true };

export function companyRoutes(): Route[] {
  return [
    // Contadores del menú.
    get('/enrollments', () => pageOf([enrollment()])),
    get('/shift-requests/summary', () => ({ pending: 1 })),
    get('/calendar/absences/summary', () => ({ pending: 1 })),
    get('/attendance/reviews/count', () => ({ pending: 1 })),
    // Empleados.
    get('/employees', () => pageOf([person(7), person(8, { first_name: 'Luis', last_name: 'Paz', full_name: 'Luis Paz', email: 'luis@acme.mx', employee_number: null, face_status: 'NOT_ENROLLED', active: false })])),
    get('/employees/ids', () => ({ ids: [7, 8], total: 2, limit: 500 })),
    get('/employees/:id', () => person(1)),
    get('/employees/:id/qr', () => qrSummary),
    get('/employees/:id/verifications', () => pageOf([verification])),
    get('/verifications', () => pageOf([companyVerification])),
    get('/employees/:id/devices', (ctx) => pageOf([device(ctx)])),
    get('/employees/:id/shift-assignments', () => pageOf([{ id: 1, shift: morning, valid_from: '2026-10-01', valid_to: null, state: 'CURRENT', created_at: '2026-10-01T10:00:00Z' }])),
    // Departamentos.
    get('/departments', () => pageOf([department])),
    get('/departments/:id', () => department),
    // Asistencia.
    get('/attendance/board', (ctx) => board(ctx)),
    get('/attendance/sessions', () => pageOf([{ ...session, employee: ref }])),
    get('/attendance/sessions/:id', () => sessionDetail),
    // Turnos, sitios y solicitudes.
    get('/shifts', () => pageOf([morning, weekend])),
    get('/shifts/:id', () => morning),
    get('/sites', () => pageOf([plant])),
    get('/sites/:id', () => plant),
    get('/sites/:id/kiosks', () => pageOf([kiosk])),
    get('/shift-requests', () => pageOf([shiftRequest])),
    // Calendario.
    get('/calendar/holidays', (ctx) => pageOf(holidays(ctx))),
    get('/calendar/absences', () => pageOf([absence])),
    get('/calendar/workdays', () => pageOf([workday])),
    // Validaciones, validadores, integraciones y documentos.
    get('/enrollments/:id', () => enrollment()),
    get('/validators', () => ({ ...pageOf([sampleValidator]), active: 1, limit: 5 })),
    get('/validators/:id', () => sampleValidator),
    get('/validators/:id/devices', () => pageOf([validatorDevice])),
    get('/api-keys', () => pageOf([apiKey])),
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
    get('/enrollment/progress', () => ({
      face_status: 'NOT_ENROLLED',
      photo: { status: 'done', checked_at: '2026-10-07T15:00:00Z', expires_at: '2026-10-10T15:00:00Z' },
      capture: { status: 'pending', submitted_at: null },
      voice: { status: 'locked', answered: 0, total: 0, attempts_left: null },
    })),
    // Documentos de identidad del onboarding (el empleado).
    get('/me/documents/requirements', () => documentRequirements),
    get('/me/documents', () => pageOf([employeeDoc])),
    get('/me/attendance/today', (ctx) => today(ctx)),
    get('/me/attendance/history', () => pageOf([session])),
    get('/me/shift-requests', () => pageOf([shiftRequest])),
    get('/me/shifts', () => pageOf([morning, weekend])),
    get('/me/absences', () => pageOf([absence])),
    get('/me/holidays', (ctx) => pageOf(holidays(ctx))),
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
