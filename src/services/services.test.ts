import { describe, expect, it } from 'vitest';
import { catalogsFixture, testCatalogs } from '../test/catalogs';
import { apiOk, mockFetch } from '../test/http';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';
import { detectedAccessories, faceErrorOutcome, faceResumeDelayMs, isRetryableFaceError, isTransientFaceError, MAX_TRANSIENT_FACE_FAILURES } from '../utils/faceErrors';
import { ApiError } from './apiClient';
import { authService } from './authService';
import { catalogService } from './catalogService';
import { departmentService } from './departmentService';
import { employeeService } from './employeeService';
import { enrollmentService } from './enrollmentService';
import { errorReportService } from './errorReportService';
import { adminService } from './adminService';
import { apiKeyService } from './apiKeyService';
import { meService } from './meService';
import { settingsService } from './settingsService';
import { faceService, verificationService } from './verificationService';
import { attendanceService } from './attendanceService';
import { shiftService } from './shiftService';
import { siteService } from './siteService';

const employee = { id: 1, employee_number: 'EMP-1', first_name: 'Ana', last_name: 'Ruiz' };
const qr = { id: 1, content: 'TCQR2:abc', employee_number: 'EMP-1', expires_at: 'x', lifetime_seconds: 30 };
const apiKey = { id: 3, name: 'ERP', prefix: 'tck_Ab3dE9fG', scopes: ['EMPLOYEES_READ'], status: 'ACTIVE' };
const qrSummary = { live: true, live_until: null, last_issued_at: null, last_used_at: null };
const detail = { id: 3, status: 'PENDING', employee_id: 1 };
const department = { id: 3, name: 'Producción', employee_count: 0, managers: [] };
const errorReport = { id: 9, code: 'INTERNAL_ERROR', status: 'PENDING', severity: 'CRITICAL', occurrences: 2 };
const result = { verified: true, method: 'FACE', message: 'ok' };
const policy = { block_glasses: true, block_headwear: true, block_mask: false, liveness_challenge: true, anti_spoofing: true, qr_enabled: true };
const site = { id: 2, name: 'Planta Norte', address: {}, radius_m: 100, active: true };
const sitePayload = { name: 'Planta Norte', address: { street: 'Av', exterior_number: '1', interior_number: null, postal_code: '83000', country_code: 'MX', state: 'S', municipality: 'H', city: 'H', latitude: 29, longitude: -110 }, radius_m: 100 };
const shift = { id: 5, name: 'Matutino', start_time: '08:00:00', end_time: '16:00:00', weekdays: [0], active: true };
const shiftPayload = { name: 'Matutino', start_time: '08:00', end_time: '16:00', weekdays: [0, 1] as const, breaks_count: 1, break_minutes: 30, early_check_in_minutes: 15, late_tolerance_minutes: 10, early_check_out_minutes: 0, late_check_out_minutes: 60 };
const assignment = { id: 8, shift, valid_from: '2026-10-05', state: 'SCHEDULED', sites: [] };
const shiftRequest = { id: 4, employee: { id: 1 }, shift, valid_from: '2026-10-06', status: 'PENDING' };
const session = { id: 6, work_date: '2026-10-05', status: 'OPEN', check_in_at: 'x', breaks: [] };
const board = { items: [{ employee: { id: 1 }, state: 'WORKING', shift_name: 'Matutino' }], total: 1, page: 1, size: 10, work_date: '2026-10-05', working: 1 };

/** Cada servicio llama al endpoint y método correctos y valida la forma de la respuesta. */
describe('servicios', () => {
  it.each([
    ['employees.list', () => employeeService.list({ search: 'ana' }), { items: [employee], total: 1 }, 'GET', '/api/employees?search=ana'],
    ['employees.get', () => employeeService.get(1), employee, 'GET', '/api/employees/1'],
    ['employees.create', () => employeeService.create({ first_name: ' Ana ', last_name: 'R', birth_date: '1990-01-01', employee_number: 'E', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '6621234567', email: 'a@e.com', password: 'x', headwear_exempt: false }), employee, 'POST', '/api/employees'],
    ['employees.update', () => employeeService.update(1, { first_name: 'B' }), employee, 'PUT', '/api/employees/1'],
    ['employees.setStatus', () => employeeService.setStatus(1, false), employee, 'PATCH', '/api/employees/1/status'],
    ['employees.remove', () => employeeService.remove(1), null, 'DELETE', '/api/employees/1'],
    ['employees.resetFace', () => employeeService.resetFace(1), employee, 'POST', '/api/employees/1/face/reset'],
    ['employees.resetAllFaces', () => employeeService.resetAllFaces('Cambio de cámaras'), { employees: 12 }, 'POST', '/api/employees/face/reset'],
    ['employees.qrSummary', () => employeeService.qrSummary(1), qrSummary, 'GET', '/api/employees/1/qr'],
    ['employees.revokeQr', () => employeeService.revokeQr(1), qrSummary, 'DELETE', '/api/employees/1/qr'],
    ['employees.history', () => employeeService.history(1, { page: 1, size: 10 }), { items: [{ id: 1, method: 'QR', success: true }], total: 1, page: 1, size: 10 }, 'GET', '/api/employees/1/verifications?page=1&size=10'],
    ['departments.list', () => departmentService.list({ page: 1, size: 10, search: 'pro' }), { items: [department], total: 1 }, 'GET', '/api/departments?page=1&size=10&search=pro'],
    ['departments.get', () => departmentService.get(3), department, 'GET', '/api/departments/3'],
    ['departments.create', () => departmentService.create({ name: 'Producción', description: null }), department, 'POST', '/api/departments'],
    ['departments.update', () => departmentService.update(3, { name: 'Producción', description: 'x' }), department, 'PUT', '/api/departments/3'],
    ['departments.remove', () => departmentService.remove(3), null, 'DELETE', '/api/departments/3'],
    ['departments.assign', () => departmentService.assign(3, 7), department, 'POST', '/api/departments/3/employees'],
    ['departments.unassign', () => departmentService.unassign(3, 7), department, 'DELETE', '/api/departments/3/employees/7'],
    ['departments.addManager', () => departmentService.addManager(3, 7), department, 'POST', '/api/departments/3/managers'],
    ['departments.removeManager', () => departmentService.removeManager(3, 7), department, 'DELETE', '/api/departments/3/managers/7'],
    ['errors.list', () => errorReportService.list({ page: 1, size: 10, status: 'PENDING' }), { items: [errorReport], total: 1 }, 'GET', '/api/admin/errors?page=1&size=10&status=PENDING'],
    ['errors.summary', () => errorReportService.summary(), { by_status: {}, pending: 0 }, 'GET', '/api/admin/errors/summary'],
    ['errors.get', () => errorReportService.get(9), errorReport, 'GET', '/api/admin/errors/9'],
    ['errors.occurrences', () => errorReportService.occurrences(9, { page: 1, size: 10 }), { items: [{ id: 1, occurred_at: 'x' }], total: 1 }, 'GET', '/api/admin/errors/9/occurrences?page=1&size=10'],
    ['errors.setStatus', () => errorReportService.setStatus(9, 'RESOLVED'), errorReport, 'PATCH', '/api/admin/errors/9/status'],
    ['errors.resolveMatching', () => errorReportService.resolveMatching({ severity: 'WARNING' }, '2026-10-03T10:00:00Z'), { resolved: 4 }, 'POST', '/api/admin/errors/resolve'],
    ['enrollments.submit', () => enrollmentService.submit({ frontal: [new Blob(['a'])] }), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['enrollments.list', () => enrollmentService.list('PENDING', { page: 1, size: 10 }), { items: [detail], total: 1 }, 'GET', '/api/enrollments?status=PENDING&page=1&size=10'],
    ['enrollments.get', () => enrollmentService.get(3), detail, 'GET', '/api/enrollments/3'],
    ['enrollments.approve', () => enrollmentService.approve(3), detail, 'POST', '/api/enrollments/3/approve'],
    ['enrollments.reject', () => enrollmentService.reject(3, 'foto borrosa'), detail, 'POST', '/api/enrollments/3/reject'],
    ['verification.face', () => verificationService.verifyFace({ frontal: [new Blob(['a'])], challenge: { id: 'c', images: [new Blob(['t'])] } }), result, 'POST', '/api/verification/face'],
    ['face.challenge', () => faceService.getChallenge(), { liveness_required: true, actions: ['LOOK_UP'], flash: ['#FF0000'] }, 'POST', '/api/face/challenge'],
    ['face.check', () => faceService.check([new Blob(['a']), new Blob(['b'])], true), { detection_score: 0.9 }, 'POST', '/api/face/check'],
    ['me.issueQr', () => meService.issueQr(), qr, 'POST', '/api/users/me/qr'],
    ['apiKeys.list', () => apiKeyService.list({ page: 1, size: 10 }), { items: [apiKey], total: 1, page: 1, size: 10 }, 'GET', '/api/api-keys?page=1&size=10'],
    ['apiKeys.create', () => apiKeyService.create({ name: ' ERP ', scopes: ['EMPLOYEES_READ'], expires_in_days: 90 }), { ...apiKey, secret: 'tck_x' }, 'POST', '/api/api-keys'],
    ['apiKeys.rotate', () => apiKeyService.rotate(3), { ...apiKey, secret: 'tck_y' }, 'POST', '/api/api-keys/3/rotate'],
    ['apiKeys.revoke', () => apiKeyService.revoke(3), apiKey, 'DELETE', '/api/api-keys/3'],
    ['me.qrStatus', () => meService.qrStatus(7), { id: 7, status: 'USED' }, 'GET', '/api/users/me/qr/7'],
    ['settings.get', () => settingsService.getVerificationPolicy(), policy, 'GET', '/api/settings/verification'],
    ['admin.policy', () => adminService.policy(4), policy, 'GET', '/api/admin/companies/4/verification-policy'],
    ['admin.updatePolicy', () => adminService.updatePolicy(4, { block_mask: false }), policy, 'PUT', '/api/admin/companies/4/verification-policy'],
    ['admin.faceLearning', () => adminService.faceLearning(4), { enabled: true, employees_learning: 1, learned_samples: 2 }, 'GET', '/api/admin/companies/4/face-learning'],
    ['admin.forgetLearnedFace', () => adminService.forgetLearnedFace(4, 1), { ...employee, active: true, face_status: 'APPROVED' }, 'DELETE', '/api/admin/companies/4/employees/1/face/learned'],
    ['enrollments.submitReview', () => enrollmentService.submit({ frontal: [new Blob(['a'])] }, true), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['auth.sessions', () => authService.sessions({ page: 1, size: 10 }), { items: [{ id: 's', created_at: 'x', current: true }], total: 1, page: 1, size: 10 }, 'GET', '/api/auth/sessions?page=1&size=10'],
    ['auth.revokeSession', () => authService.revokeSession('s/1'), null, 'DELETE', '/api/auth/sessions/s%2F1'],
    ['auth.logoutAll', () => authService.logoutAll(), { revoked: 1 }, 'POST', '/api/auth/logout-all'],
    ['auth.remembered', () => authService.remembered(), { email: 'ana@empresa.com' }, 'GET', '/api/auth/remembered'],
    ['auth.rememberedNone', () => authService.remembered(), null, 'GET', '/api/auth/remembered'],
    ['auth.forgetRemembered', () => authService.forgetRemembered(), null, 'DELETE', '/api/auth/remembered'],
    ['me.updatePreferences', () => meService.updatePreferences({ sidebar_collapsed: true }), { sidebar_collapsed: true }, 'PATCH', '/api/users/me/preferences'],
    ['catalogs.getAll', () => catalogService.getAll(), catalogsFixture, 'GET', '/api/catalogs'],
    ['sites.list', () => siteService.list({ page: 1, size: 10, search: 'pla', active: true }), { items: [site], total: 1 }, 'GET', '/api/sites?page=1&size=10&search=pla&active=true'],
    ['sites.get', () => siteService.get(2), site, 'GET', '/api/sites/2'],
    ['sites.create', () => siteService.create(sitePayload), site, 'POST', '/api/sites'],
    ['sites.update', () => siteService.update(2, sitePayload), site, 'PUT', '/api/sites/2'],
    ['sites.setStatus', () => siteService.setStatus(2, false), site, 'PATCH', '/api/sites/2/status'],
    ['sites.remove', () => siteService.remove(2), null, 'DELETE', '/api/sites/2'],
    ['shifts.list', () => shiftService.list({ page: 1, size: 10, active: true }), { items: [shift], total: 1 }, 'GET', '/api/shifts?page=1&size=10&active=true'],
    ['shifts.get', () => shiftService.get(5), shift, 'GET', '/api/shifts/5'],
    ['shifts.create', () => shiftService.create({ ...shiftPayload, weekdays: [0, 1] }), shift, 'POST', '/api/shifts'],
    ['shifts.update', () => shiftService.update(5, { ...shiftPayload, weekdays: [0, 1] }), shift, 'PUT', '/api/shifts/5'],
    ['shifts.setStatus', () => shiftService.setStatus(5, false), shift, 'PATCH', '/api/shifts/5/status'],
    ['shifts.remove', () => shiftService.remove(5), null, 'DELETE', '/api/shifts/5'],
    ['shifts.assignments', () => shiftService.assignments(1, { page: 1, size: 10 }), { items: [assignment], total: 1 }, 'GET', '/api/employees/1/shift-assignments?page=1&size=10'],
    ['shifts.assign', () => shiftService.assign(1, { shift_id: 5, valid_from: '2026-10-05', remote_weekdays: [], site_ids: [2] }), assignment, 'POST', '/api/employees/1/shift-assignments'],
    ['shifts.cancelAssignment', () => shiftService.cancelAssignment(8), null, 'DELETE', '/api/shift-assignments/8'],
    ['shifts.requests', () => shiftService.requests({ page: 1, size: 10, status: 'PENDING' }), { items: [shiftRequest], total: 1 }, 'GET', '/api/shift-requests?page=1&size=10&status=PENDING'],
    ['shifts.pendingRequests', () => shiftService.pendingRequests(), { pending: 2 }, 'GET', '/api/shift-requests/summary'],
    ['shifts.approve', () => shiftService.approve(4), shiftRequest, 'POST', '/api/shift-requests/4/approve'],
    ['shifts.reject', () => shiftService.reject(4, ' Sin cupo '), shiftRequest, 'POST', '/api/shift-requests/4/reject'],
    ['attendance.board', () => attendanceService.board({ page: 1, size: 10, date: '2026-10-05' }), board, 'GET', '/api/attendance/board?page=1&size=10&date=2026-10-05'],
    ['attendance.sessions', () => attendanceService.sessions({ page: 1, size: 10, status: 'CLOSED' }), { items: [{ ...session, employee: { id: 1 } }], total: 1 }, 'GET', '/api/attendance/sessions?page=1&size=10&status=CLOSED'],
    ['attendance.session', () => attendanceService.session(6), { ...session, employee: { id: 1 }, events: [] }, 'GET', '/api/attendance/sessions/6'],
    ['attendance.today', () => attendanceService.today(), { now: 'x', actions: [], message: 'm', sites: [] }, 'GET', '/api/me/attendance/today'],
    ['attendance.record', () => attendanceService.record('BREAK_START', { frontal: [new Blob(['a'])] }, { latitude: 29, longitude: -110, accuracy: 12 }), { verified: true, message: 'm', action: 'BREAK_START', verification: result }, 'POST', '/api/me/attendance/break-start'],
    ['attendance.history', () => attendanceService.history({ page: 1, size: 10 }), { items: [session], total: 1 }, 'GET', '/api/me/attendance/history?page=1&size=10'],
    ['attendance.availableShifts', () => attendanceService.availableShifts({ page: 1, size: 50 }), { items: [shift], total: 1 }, 'GET', '/api/me/shifts?page=1&size=50'],
    ['attendance.myRequests', () => attendanceService.myRequests({ page: 1, size: 10 }), { items: [shiftRequest], total: 1 }, 'GET', '/api/me/shift-requests?page=1&size=10'],
    ['attendance.requestChange', () => attendanceService.requestChange({ shift_id: 5, valid_from: '2026-10-06', reason: ' Estudio ' }), shiftRequest, 'POST', '/api/me/shift-requests'],
    ['attendance.cancelRequest', () => attendanceService.cancelRequest(4), shiftRequest, 'POST', '/api/me/shift-requests/4/cancel'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('asistencia: el registro envía la ubicación con la precisión acotada; un tablero sin conteos no es válido', async () => {
    const { calls } = mockFetch(apiOk({ verified: true, message: 'm', action: 'CHECK_IN', verification: result }), apiOk({ items: [], total: 0 }));
    await attendanceService.record('CHECK_IN', { frontal: [new Blob(['a'])] }, { latitude: 29.1, longitude: -110.9, accuracy: 250_000 });
    const form = calls[0].init.body as FormData;
    expect([form.get('latitude'), form.get('longitude'), form.get('accuracy')]).toEqual(['29.1', '-110.9', '100000']);
    expect(calls[0].url).toBe('/api/me/attendance/check-in');
    await expect(attendanceService.board({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('las solicitudes y el motivo del rechazo viajan sin espacios sobrantes', async () => {
    const { calls } = mockFetch(apiOk(shiftRequest));
    await shiftService.reject(4, '  Sin cupo  ');
    await attendanceService.requestChange({ shift_id: 5, valid_from: '2026-10-06', reason: '  Estudio  ' });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ note: 'Sin cupo' });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ shift_id: 5, valid_from: '2026-10-06', reason: 'Estudio' });
  });

  it('rechaza respuestas con forma inesperada', async () => {
    mockFetch(apiOk({ id: 'sin-campos' }), apiOk({ liveness_required: true, actions: ['TURN_LEFT'] }));
    await expect(employeeService.get(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    // Un reto sin los colores del destello (servidor anterior) no se usa: el flujo lo trata como falla.
    await expect(faceService.getChallenge()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('catálogos: exige cada lista con registros {code, name, sort_order, active}', async () => {
    mockFetch(apiOk({ ...catalogsFixture, countries: [{ code: 'MX' }] }), apiOk({ ...catalogsFixture, roles: null }));
    await expect(catalogService.getAll()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(catalogService.getAll()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('errores faciales', () => {
  const apiError = (statusCode: number, code: string) => new ApiError({ statusCode, code, message: 'x' });

  it('identifica errores corregibles (catálogo face_errors) y accesorios', () => {
    const accessories = new ApiError({
      statusCode: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Quita lentes',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'm', field: null, details: { accessories: ['GLASSES', 7] } }],
    });
    expect(isRetryableFaceError(accessories, testCatalogs)).toBe(true);
    expect(detectedAccessories(accessories)).toEqual(['GLASSES']);
    expect(isRetryableFaceError(apiError(422, 'POSE_TILTED'), testCatalogs)).toBe(true);
    expect(isRetryableFaceError(new Error('x'), testCatalogs)).toBe(false);
    expect(detectedAccessories(new Error('x'))).toEqual([]);
    expect(detectedAccessories(new ApiError({ statusCode: 422, code: 'ACCESSORIES_DETECTED', message: 'x' }))).toEqual([]);
  });

  it('no se reintenta lo que el catálogo marca como no corregible ni lo que no conoce', () => {
    expect(isRetryableFaceError(apiError(404, 'FACE_NOT_REGISTERED'), testCatalogs)).toBe(false);
    expect(isRetryableFaceError(apiError(503, 'FACE_SERVICE_UNAVAILABLE'), testCatalogs)).toBe(false);
    expect(isRetryableFaceError(apiError(403, 'FORBIDDEN'), testCatalogs)).toBe(false);
  });

  it('fallas de red o de carga siempre se reintentan (no dependen del catálogo)', () => {
    expect(isRetryableFaceError(apiError(0, 'NETWORK_ERROR'), testCatalogs)).toBe(true);
    expect(isRetryableFaceError(apiError(503, 'SERVER_BUSY'), testCatalogs)).toBe(true);
    expect(isRetryableFaceError(apiError(408, 'TIMEOUT'), testCatalogs)).toBe(true);
    // La cámara sin imagen en ese momento (abriéndose, cortada por una llamada): se espera, no se abandona.
    expect(isRetryableFaceError(new CameraNotReadyError(), testCatalogs)).toBe(true);
    expect(new CameraNotReadyError().message).toBe('La cámara aún no está lista');
  });

  it('la red que sigue fallando no se reintenta sin fin: a la segunda falla seguida se rinde', () => {
    const busy = apiError(503, 'SERVER_BUSY');
    expect(isTransientFaceError(busy)).toBe(true);
    expect(isTransientFaceError(apiError(422, 'POSE_TILTED'))).toBe(false);
    expect(isTransientFaceError(new CameraNotReadyError())).toBe(false);
    const first = faceErrorOutcome(busy, testCatalogs, 0);
    expect(first).toEqual({ fatal: false, streak: 1 });
    expect(faceErrorOutcome(apiError(0, 'NETWORK_ERROR'), testCatalogs, first.streak)).toEqual({ fatal: true, streak: 0 });
    expect(MAX_TRANSIENT_FACE_FAILURES).toBe(2);
    // Un error corregible entre medias (el servidor sí respondió) reinicia la cuenta.
    expect(faceErrorOutcome(apiError(422, 'POSE_TILTED'), testCatalogs, 1)).toEqual({ fatal: false, streak: 0 });
    expect(faceErrorOutcome(apiError(403, 'FORBIDDEN'), testCatalogs, 0)).toEqual({ fatal: true, streak: 0 });
  });

  it('reanuda tras la pausa del flujo o la que pide el servidor (Retry-After, con tope)', () => {
    const hinted = (ms: number) => new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: 'x' }, ms);
    expect(faceResumeDelayMs(apiError(0, 'NETWORK_ERROR'))).toBe(config.faceResumeAfterBlockMs);
    expect(faceResumeDelayMs(hinted(1_000))).toBe(config.faceResumeAfterBlockMs);
    expect(faceResumeDelayMs(hinted(8_000))).toBe(8_000);
    expect(faceResumeDelayMs(hinted(3_600_000))).toBe(config.apiMaxRetryAfterMs);
    expect(faceResumeDelayMs(new Error('x'))).toBe(config.faceResumeAfterBlockMs);
  });
});

describe('rostro en persona (la empresa con el empleado presente)', () => {
  it('registra (aprobado al momento) y verifica con las capturas y el reto de la empresa', async () => {
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/enroll')
        ? apiOk({ enrollment_id: 9, face_status: 'APPROVED', message: 'ok' })
        : apiOk({ verified: true, method: 'FACE', message: 'Identificación exitosa' }),
    );
    const frame = new Blob(['f'], { type: 'image/jpeg' });
    const challenge = { id: 'ch-1', images: [new Blob(['t'], { type: 'image/jpeg' })] };
    expect((await employeeService.enrollFaceInPerson(5, { frontal: [frame, frame], challenge })).face_status).toBe('APPROVED');
    expect((await employeeService.verifyFaceInPerson(5, { frontal: [frame], challenge })).verified).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['/api/employees/5/face/enroll', '/api/employees/5/face/verify']);
    const form = calls[0].init.body as FormData;
    expect(form.getAll('images')).toHaveLength(2);
    expect(form.get('challenge_id')).toBe('ch-1');
  });
});
