import { describe, expect, it } from 'vitest';
import { catalogsFixture, testCatalogs } from '../test/catalogs';
import { apiOk, mockFetch } from '../test/http';
import { detectedAccessories, isRetryableFaceError } from '../utils/faceErrors';
import { ApiError } from './apiClient';
import { authService } from './authService';
import { catalogService } from './catalogService';
import { employeeService } from './employeeService';
import { enrollmentService } from './enrollmentService';
import { meService } from './meService';
import { settingsService } from './settingsService';
import { faceService, verificationService } from './verificationService';

const employee = { id: 1, employee_number: 'EMP-1', first_name: 'Ana', last_name: 'Ruiz' };
const qr = { id: 1, image_base64: 'data:', employee_number: 'EMP-1', expires_at: 'x', lifetime_seconds: 30 };
const qrSummary = { live: true, live_until: null, last_issued_at: null, last_used_at: null };
const detail = { id: 3, status: 'PENDING', employee_id: 1 };
const result = { verified: true, method: 'FACE', message: 'ok' };
const policy = { block_glasses: true, block_headwear: true, block_mask: false, liveness_challenge: true, anti_spoofing: true, qr_enabled: true };

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
    ['employees.qrSummary', () => employeeService.qrSummary(1), qrSummary, 'GET', '/api/employees/1/qr'],
    ['employees.revokeQr', () => employeeService.revokeQr(1), qrSummary, 'DELETE', '/api/employees/1/qr'],
    ['employees.history', () => employeeService.history(1, { page: 1, size: 10 }), { items: [{ id: 1, method: 'QR', success: true }], total: 1, page: 1, size: 10 }, 'GET', '/api/employees/1/verifications?page=1&size=10'],
    ['enrollments.submit', () => enrollmentService.submit({ frontal: [new Blob(['a'])] }), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['enrollments.list', () => enrollmentService.list('PENDING', { page: 1, size: 10 }), { items: [detail], total: 1 }, 'GET', '/api/enrollments?status=PENDING&page=1&size=10'],
    ['enrollments.get', () => enrollmentService.get(3), detail, 'GET', '/api/enrollments/3'],
    ['enrollments.approve', () => enrollmentService.approve(3), detail, 'POST', '/api/enrollments/3/approve'],
    ['enrollments.reject', () => enrollmentService.reject(3, 'foto borrosa'), detail, 'POST', '/api/enrollments/3/reject'],
    ['verification.face', () => verificationService.verifyFace({ frontal: [new Blob(['a'])], challenge: { id: 'c', images: [new Blob(['t'])] } }), result, 'POST', '/api/verification/face'],
    ['face.challenge', () => faceService.getChallenge(), { liveness_required: true }, 'POST', '/api/face/challenge'],
    ['face.check', () => faceService.check([new Blob(['a']), new Blob(['b'])], true), { detection_score: 0.9 }, 'POST', '/api/face/check'],
    ['me.issueQr', () => meService.issueQr(), qr, 'POST', '/api/users/me/qr'],
    ['me.qrStatus', () => meService.qrStatus(7), { id: 7, status: 'USED' }, 'GET', '/api/users/me/qr/7'],
    ['settings.get', () => settingsService.getVerificationPolicy(), policy, 'GET', '/api/settings/verification'],
    ['settings.update', () => settingsService.updateVerificationPolicy({ block_mask: false }), policy, 'PUT', '/api/settings/verification'],
    ['enrollments.submitReview', () => enrollmentService.submit({ frontal: [new Blob(['a'])] }, true), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['auth.sessions', () => authService.sessions({ page: 1, size: 10 }), { items: [{ id: 's', created_at: 'x', current: true }], total: 1, page: 1, size: 10 }, 'GET', '/api/auth/sessions?page=1&size=10'],
    ['auth.revokeSession', () => authService.revokeSession('s/1'), null, 'DELETE', '/api/auth/sessions/s%2F1'],
    ['auth.logoutAll', () => authService.logoutAll(), { revoked: 1 }, 'POST', '/api/auth/logout-all'],
    ['auth.remembered', () => authService.remembered(), { email: 'ana@empresa.com' }, 'GET', '/api/auth/remembered'],
    ['auth.rememberedNone', () => authService.remembered(), null, 'GET', '/api/auth/remembered'],
    ['auth.forgetRemembered', () => authService.forgetRemembered(), null, 'DELETE', '/api/auth/remembered'],
    ['me.updatePreferences', () => meService.updatePreferences({ sidebar_collapsed: true }), { sidebar_collapsed: true }, 'PATCH', '/api/users/me/preferences'],
    ['catalogs.getAll', () => catalogService.getAll(), catalogsFixture, 'GET', '/api/catalogs'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    mockFetch(apiOk({ id: 'sin-campos' }));
    await expect(employeeService.get(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
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
