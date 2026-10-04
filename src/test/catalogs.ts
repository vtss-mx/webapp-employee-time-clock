import type { AntispoofLevelItem, CatalogItem, Catalogs, ConfidenceLevelItem, CountryItem, FaceErrorItem, ReasonItem } from '../types';
import { createCatalogApi, type CatalogApi } from '../utils/catalogs';

/**
 * Catálogos de prueba: los mismos registros que GET /api/catalogs (backend, alembic/seed/catalogs.json),
 * salvo los países, de los que basta una muestra (los frecuentes y algunos más).
 */

/** Registro base; `sort_order` = posición en la lista (1, 2, 3...). */
function rows<Code extends string, Extra extends object>(
  entries: Array<[Code, string, string | null, Extra?]>,
): Array<CatalogItem<Code> & Extra> {
  return entries.map(([code, name, description, extra], index) => ({
    code,
    name,
    description,
    sort_order: index + 1,
    active: true,
    ...(extra as Extra),
  }));
}

const reasons = (entries: Array<[string, string, string]>): ReasonItem[] =>
  rows(entries.map(([code, name, message]) => [code, name, null, { message }]));

/** [código, nombre, lada, frecuente] */
const COUNTRIES: Array<[string, string, string, boolean]> = [
  ['MX', 'México', '+52', true],
  ['US', 'Estados Unidos', '+1', true],
  ['CA', 'Canadá', '+1', true],
  ['GT', 'Guatemala', '+502', true],
  ['SV', 'El Salvador', '+503', true],
  ['HN', 'Honduras', '+504', true],
  ['CR', 'Costa Rica', '+506', true],
  ['PA', 'Panamá', '+507', true],
  ['CO', 'Colombia', '+57', true],
  ['ES', 'España', '+34', true],
  ['DE', 'Alemania', '+49', false],
  ['AG', 'Antigua y Barbuda', '+1', false],
  ['AR', 'Argentina', '+54', false],
  ['BR', 'Brasil', '+55', false],
  ['CL', 'Chile', '+56', false],
  ['FR', 'Francia', '+33', false],
  ['PE', 'Perú', '+51', false],
];

/** [posición, nombre, valor, similitud, % impostores aceptados, % rechazos legítimos] */
const CONFIDENCE: Array<[number, string, number, number, number, number]> = [
  [80, 'Flexible', 0.8, 0.386, 0.033, 0.9],
  [81, 'Flexible', 0.81, 0.388, 0.033, 0.9],
  [82, 'Flexible', 0.82, 0.39, 0.033, 0.9],
  [83, 'Flexible', 0.83, 0.392, 0.033, 0.9],
  [84, 'Flexible', 0.84, 0.394, 0.033, 0.9],
  [85, 'Flexible', 0.85, 0.396, 0.033, 0.9],
  [86, 'Flexible', 0.86, 0.398, 0.033, 1.0],
  [87, 'Flexible', 0.87, 0.4, 0.033, 1.0],
  [88, 'Flexible', 0.88, 0.402, 0.033, 1.0],
  [89, 'Flexible', 0.89, 0.405, 0.033, 1.0],
  [90, 'Equilibrado', 0.9, 0.408, 0.033, 1.1],
  [91, 'Equilibrado', 0.91, 0.411, 0.033, 1.1],
  [92, 'Equilibrado', 0.92, 0.414, 0.033, 1.2],
  [93, 'Equilibrado', 0.93, 0.418, 0.033, 1.2],
  [94, 'Equilibrado', 0.94, 0.422, 0.033, 1.3],
  [95, 'Alto', 0.95, 0.427, 0.033, 1.3],
  [96, 'Alto', 0.96, 0.434, 0.033, 1.4],
  [97, 'Alto', 0.97, 0.441, 0.033, 1.5],
  [98, 'Alto', 0.98, 0.452, 0.033, 1.7],
  [99, 'Estricto', 0.99, 0.471, 0, 2.4],
  [100, 'Máximo', 0.99999, 0.653, 0, 24.3],
];

/** Códigos de face_errors; todos se pueden reintentar salvo los indicados. */
const FACE_ERROR_CODES = [
  'EMPTY_IMAGE', 'INVALID_IMAGE_FORMAT', 'IMAGE_TOO_SMALL', 'IMAGE_TOO_LARGE', 'INVALID_IMAGE', 'NO_FACE', 'MULTIPLE_FACES',
  'LOW_DETECTION_SCORE', 'FACE_TOO_SMALL', 'FACE_CUT_OFF', 'POSE_NOT_FRONTAL', 'POSE_TILTED', 'POSE_PITCH', 'TOO_DARK',
  'TOO_BRIGHT', 'TOO_BLURRY', 'ACCESSORIES_DETECTED', 'SPOOF_DETECTED', 'ENROLL_INCONSISTENT', 'LIVENESS_REQUIRED',
  'CHALLENGE_INVALID', 'LIVENESS_FAILED', 'LIVENESS_MISMATCH', 'FACE_NOT_REGISTERED', 'FACE_SERVICE_BUSY',
  'FACE_SERVICE_UNAVAILABLE', 'FACE_PROCESSING_ERROR', 'IMAGE_NOT_FROM_CAMERA', 'STATIC_CAPTURE', 'REPLAY_DETECTED',
  'CAPTURE_INCONSISTENT', 'VIRTUAL_CAMERA', 'CHALLENGE_TOO_FAST', 'FACE_ALREADY_REGISTERED', 'FACE_LOCKED',
];
const NOT_RETRYABLE = new Set(['FACE_NOT_REGISTERED', 'FACE_SERVICE_UNAVAILABLE', 'FACE_ALREADY_REGISTERED', 'FACE_LOCKED']);

export const catalogsFixture: Catalogs = {
  roles: rows([
    ['ADMIN', 'Admin', 'Administrador de la plataforma.'],
    ['COMPANY', 'Company', 'Administrador de una empresa.'],
    ['EMPLOYEE', 'Employee', 'Empleado.'],
    ['VALIDATOR', 'Validator', 'Validador de identidad.'],
  ]),
  verification_methods: rows([
    ['FACE', 'Rostro', 'La persona mira a la cámara; se busca entre todo el personal'],
    ['QR', 'QR', 'Credencial impresa o en el teléfono del empleado'],
    ['QR_FACE', 'QR + rostro', 'Escanea su QR y confirma que el rostro es de su dueño'],
  ]),
  validator_modes: rows([
    ['QR_OR_FACE', 'QR o rostro', 'El operador elige en cada identificación: credencial QR o reconocimiento facial.', { methods: ['FACE', 'QR'] }],
    ['QR', 'Solo QR', 'Escanea el código QR de la credencial del empleado (impresa o en su teléfono).', { methods: ['QR'] }],
    ['FACE', 'Solo rostro', 'Reconoce al empleado por su rostro entre todo el personal, sin credencial.', { methods: ['FACE'] }],
    ['QR_AND_FACE', 'QR y rostro', 'Máxima seguridad: escanea el QR y el rostro debe ser el de su dueño.', { methods: ['QR_FACE'] }],
  ]),
  face_statuses: rows([
    ['NOT_ENROLLED', 'Sin registrar', 'El empleado aún no registra su rostro. Se le pedirá en su próximo inicio de sesión.', { tone: 'muted', employee_note: 'Registrarás tu rostro al entrar' }],
    ['PENDING_REVIEW', 'En validación', 'El empleado registró su rostro y espera tu validación.', { tone: 'warning', employee_note: 'Tu identidad está en validación' }],
    ['APPROVED', 'Validado', 'Identidad validada. Puede identificarse con su rostro o su código QR.', { tone: 'success', employee_note: 'Identidad validada' }],
    ['REJECTED', 'Rechazado', 'El registro fue rechazado; el empleado deberá registrarse de nuevo.', { tone: 'danger', employee_note: 'Debes registrar tu rostro de nuevo' }],
  ]),
  enrollment_statuses: rows([
    ['PENDING', 'Pendiente', 'Registro facial en espera de validación.', { tone: 'warning' }],
    ['APPROVED', 'Aceptado', 'La empresa aceptó el registro facial.', { tone: 'success' }],
    ['REJECTED', 'Rechazado', 'La empresa rechazó el registro facial.', { tone: 'danger' }],
  ]),
  device_statuses: rows([
    ['PENDING', 'Por autorizar', 'El validador inició sesión en este dispositivo y espera la autorización de la empresa.', { tone: 'warning' }],
    ['APPROVED', 'Autorizado', 'La empresa autorizó el dispositivo: el validador puede operar en él.', { tone: 'success' }],
    ['REJECTED', 'Rechazado', 'La empresa no autorizó el dispositivo.', { tone: 'danger' }],
    ['REVOKED', 'Revocado', 'La empresa retiró la autorización: sus sesiones se cerraron.', { tone: 'muted' }],
  ]),
  api_scopes: rows([
    ['EMPLOYEES_READ', 'Empleados', 'Consultar los empleados (GET /employees y /employees/{id}).'],
    ['ATTENDANCE_READ', 'Identificaciones', 'Consultar la bitácora de identificaciones (GET /attendance).'],
    ['VALIDATORS_READ', 'Validadores', 'Consultar los validadores de identidad (GET /validators).'],
  ]),
  api_key_statuses: rows([
    ['ACTIVE', 'Activa', 'La llave da acceso a la API con sus permisos.', { tone: 'success' }],
    ['EXPIRED', 'Vencida', 'Llegó a su fecha de vencimiento: ya no da acceso.', { tone: 'warning' }],
    ['REVOKED', 'Revocada', 'La empresa la revocó (o la rotó): ya no da acceso.', { tone: 'muted' }],
  ]),
  error_statuses: rows([
    ['PENDING', 'Pendiente', 'Nadie lo ha tomado todavía (o volvió a ocurrir después de solucionarse).', { tone: 'danger' }],
    ['IN_PROGRESS', 'En proceso', 'Alguien está trabajando en la causa.', { tone: 'warning' }],
    ['IN_REVIEW', 'En revisión', 'La corrección está hecha y se está verificando.', { tone: 'info' }],
    ['RESOLVED', 'Solucionado', 'Corregido. Si vuelve a ocurrir, se reabre solo como pendiente.', { tone: 'success' }],
  ]),
  work_modes: rows([
    ['ON_SITE', 'En sitio', 'Dentro de la geocerca de uno de sus sitios de trabajo.'],
    ['REMOTE', 'Remoto', 'Desde cualquier lugar, en un día que la empresa le permite trabajar remoto.'],
    ['VALIDATOR', 'Validador', 'Al identificarse en la tableta de un validador (cuenta como en sitio).'],
    ['COMPANY', 'Registrado por la empresa', 'La empresa lo registró o lo corrigió (sin rostro ni ubicación), con su motivo.'],
  ]),
  attendance_actions: rows([
    ['CHECK_IN', 'Entrada', 'Inicio de la jornada del turno.'],
    ['BREAK_START', 'Inicio de descanso', 'Empieza uno de los descansos del turno.'],
    ['BREAK_END', 'Fin de descanso', 'Termina el descanso en curso.'],
    ['CHECK_OUT', 'Salida', 'Fin de la jornada del turno.'],
  ]),
  work_session_statuses: rows([
    ['OPEN', 'En turno', 'Tiene entrada y aún no checa su salida.', { tone: 'info' }],
    ['CLOSED', 'Completa', 'Checó entrada y salida.', { tone: 'success' }],
    ['MISSED_CHECKOUT', 'Sin salida', 'Venció el límite para checar la salida sin hacerlo.', { tone: 'danger' }],
  ]),
  shift_request_statuses: rows([
    ['PENDING', 'Pendiente', 'Espera la decisión de la empresa.', { tone: 'warning' }],
    ['APPROVED', 'Aprobada', 'La empresa la aprobó: aplica desde la fecha pedida (el nuevo turno o los días libres).', { tone: 'success' }],
    ['REJECTED', 'Rechazada', 'La empresa no la aprobó (con su motivo).', { tone: 'danger' }],
    ['CANCELLED', 'Cancelada', 'Se retiró y ya no aplica (el empleado antes de que se decidiera, o la empresa).', { tone: 'muted' }],
  ]),
  board_states: rows([
    ['SCHEDULED', 'Programado', 'Aún no es la hora de su entrada.', { tone: 'muted' }],
    ['MISSING', 'Sin entrada', 'Ya debió entrar y no ha checado su entrada.', { tone: 'warning' }],
    ['WORKING', 'En turno', 'Checó su entrada y está trabajando.', { tone: 'info' }],
    ['ON_BREAK', 'En descanso', 'Está en uno de los descansos de su turno.', { tone: 'info' }],
    ['DONE', 'Salió', 'Checó su entrada y su salida.', { tone: 'success' }],
    ['MISSED_CHECKOUT', 'Sin salida', 'Venció el límite para checar su salida sin hacerlo.', { tone: 'danger' }],
    ['ABSENT', 'Faltó', 'Terminó su turno sin checar su entrada.', { tone: 'danger' }],
    ['DAY_OFF', 'Día libre', 'Ese día no trabaja: día festivo, vacaciones, permiso o incapacidad (no es una falta).', { tone: 'muted' }],
  ]),
  assignment_states: rows([
    ['CURRENT', 'Vigente', 'El turno que rige hoy.', { tone: 'success' }],
    ['SCHEDULED', 'Programado', 'Cambio de turno que empieza después (se puede cancelar antes de esa fecha).', { tone: 'info' }],
    ['ENDED', 'Terminado', 'Ya no rige: lo registrado con él lo conserva.', { tone: 'muted' }],
  ]),
  day_off_types: rows([
    ['VACATION', 'Vacaciones', 'Días de vacaciones del empleado (los puede pedir desde Mi asistencia).', { tone: 'info', phrase: 'Estás de vacaciones', requestable: true }],
    ['PERMISSION', 'Permiso', 'Permiso para faltar con autorización de la empresa (lo puede pedir desde Mi asistencia).', { tone: 'info', phrase: 'Tienes permiso', requestable: true }],
    ['SICK_LEAVE', 'Incapacidad', 'Incapacidad médica (la registra la empresa).', { tone: 'warning', phrase: 'Tienes incapacidad', requestable: false }],
    ['OTHER', 'Otro motivo', 'Otro día libre que autoriza la empresa (la registra la empresa).', { tone: 'muted', phrase: 'Tienes día libre', requestable: false }],
  ]),
  attendance_edit_reasons: rows([
    ['FORGOT', 'Olvidó checar', 'El empleado trabajó pero no registró su entrada, su descanso o su salida.'],
    ['DEVICE_FAILURE', 'Falla de su teléfono o de la cámara', 'No pudo registrar con su rostro por una falla de su dispositivo.'],
    ['NO_CONNECTION', 'Sin conexión en el sitio', 'No había internet ni ubicación para registrar en ese momento.'],
    ['AUTHORIZED_OFFSITE', 'Trabajó fuera de su sitio con autorización', 'Una comisión o visita autorizada por la empresa fuera de sus sitios.'],
    ['WRONG_RECORD', 'Registro equivocado', 'La hora registrada no corresponde a lo que realmente ocurrió.'],
  ]),
  error_severities: rows([
    ['CRITICAL', 'Crítico', 'Falla no controlada (500) o en un proceso en segundo plano.', { tone: 'danger' }],
    ['ERROR', 'Error', 'Servicio no disponible u ocupado (5xx controlado).', { tone: 'warning' }],
    ['WARNING', 'Advertencia', 'Solicitud rechazada: validación, permisos o reglas de negocio (4xx).', { tone: 'info' }],
  ]),
  verification_reasons: reasons([
    ['NO_MATCH', 'Rostro no coincide', 'Rostro no reconocido'],
    ['LIVENESS_FAILED', 'Prueba de vida no superada', 'No se detectó el giro de cabeza solicitado'],
    ['LIVENESS_MISMATCH', 'Capturas de personas distintas', 'Las capturas no corresponden a la misma persona'],
    ['FACE_NOT_REGISTERED', 'Sin rostro validado', 'El empleado aún no tiene su rostro validado por la empresa'],
    ['EMPTY_GALLERY', 'Sin rostros registrados', 'Aún no hay empleados con identidad validada en esta empresa'],
    ['AMBIGUOUS_MATCH', 'Parecido a varias personas', 'No fue posible distinguir a la persona con suficiente certeza'],
    ['INCONSISTENT_MATCH', 'Capturas no concluyentes', 'Las capturas no coinciden con una sola persona'],
    ['INVALID_FORMAT', 'QR inválido', 'QR inválido'],
    ['NOT_FOUND', 'QR no reconocido', 'QR no reconocido'],
    ['OTHER_COMPANY', 'QR no reconocido', 'QR no reconocido'],
    ['REVOKED', 'QR revocado', 'QR no reconocido'],
    ['EXPIRED', 'QR expirado', 'El QR ha expirado. Solicita uno nuevo a tu empresa'],
    ['OTHER_EMPLOYEE', 'QR de otro empleado', 'QR no reconocido'],
    ['EMPLOYEE_INACTIVE', 'Empleado desactivado', 'El empleado está desactivado'],
    ['SPOOF_DETECTED', 'Posible foto o pantalla', 'No se pudo confirmar que seas una persona frente a la cámara.'],
    ['IMAGE_NOT_FROM_CAMERA', 'Imagen que no es de la cámara', 'La imagen no proviene de la cámara de la aplicación.'],
    ['STATIC_CAPTURE', 'Foto fija', 'Las capturas son idénticas.'],
    ['REPLAY_DETECTED', 'Captura reutilizada', 'Esta captura ya se había usado antes.'],
    ['CAPTURE_INCONSISTENT', 'Capturas de tomas distintas', 'Las capturas no parecen de la misma toma.'],
    ['VIRTUAL_CAMERA', 'Cámara virtual', 'No se permiten cámaras virtuales.'],
    ['CHALLENGE_TOO_FAST', 'Giro demasiado rápido', 'El giro se capturó demasiado rápido.'],
  ]),
  accessories: rows([
    ['GLASSES', 'Lentes', null, { phrase: 'los lentes' }],
    ['HEADWEAR', 'Gorra', null, { phrase: 'la gorra o sombrero' }],
    ['MASK', 'Cubrebocas', null, { phrase: 'el cubrebocas' }],
  ]),
  countries: COUNTRIES.map(([code, name, dial_code, featured], index): CountryItem => ({
    code,
    name,
    description: null,
    dial_code,
    featured,
    sort_order: index + 1,
    active: true,
  })),
  enrollment_rejection_reasons: rows([
    ['PERSON_MISMATCH', 'La persona de la foto no corresponde al empleado', null],
    ['UNCLEAR_PHOTO', 'La fotografía no es clara', null],
    ['SPOOFING', 'Se detecta suplantación (foto de foto o pantalla)', null],
    ['WRONG_DATA', 'Datos del empleado incorrectos', null],
  ]),
  reverification_reasons: rows([
    ['PERIODIC', 'Actualización periódica de identidad', null],
    ['APPEARANCE_CHANGE', 'Cambio importante de apariencia', null],
    ['FREQUENT_FAILURES', 'Fallas frecuentes al identificarse', null],
    ['SUSPECTED_SPOOFING', 'Sospecha de suplantación de identidad', null],
  ]),
  confidence_levels: CONFIDENCE.map(([position, name, value, similarity, falseAccept, rejection]): ConfidenceLevelItem => ({
    code: String(position),
    name,
    description: null,
    sort_order: position,
    active: true,
    value,
    similarity,
    false_accept_rate: falseAccept,
    rejection_rate: rejection,
  })),
  antispoof_levels: [
    ['STANDARD', 'Estándar', 'Rechaza cuando la mayoría de las capturas parecen una foto, una pantalla o un video.', 0.05, false],
    ['HIGH', 'Alto', 'Más sensible: rechaza ante indicios moderados de foto o pantalla.', 0.3, false],
    ['MAXIMUM', 'Máximo', 'Basta con que una sola captura parezca una foto o una pantalla para rechazar.', 0.5, true],
  ].map(([code, name, description, threshold, anyFrame], index): AntispoofLevelItem => ({
    code: code as string,
    name: name as string,
    description: description as string,
    sort_order: index + 1,
    active: true,
    threshold: threshold as number,
    any_frame: anyFrame as boolean,
  })),
  flash_modes: rows([
    ['OFF', 'Apagado', 'La pantalla no destella colores durante la prueba de vida.'],
    ['OBSERVE', 'Solo medir', 'La pantalla destella colores y se mide cómo los refleja el rostro, sin bloquear a nadie.'],
    ['ENFORCE', 'Obligatorio', 'El rostro debe reflejar los colores que pinta la pantalla: un video inyectado o generado no los ve.'],
  ]),
  face_errors: FACE_ERROR_CODES.map((code, index): FaceErrorItem => ({
    code,
    name: code,
    description: null,
    message: `Mensaje de ${code}`,
    retryable: !NOT_RETRYABLE.has(code),
    sort_order: index + 1,
    active: true,
  })),
  enrollment_flags: rows([
    ['GLASSES', 'Posibles lentes', 'El sistema detectó posibles lentes y el empleado indicó que no los usa.'],
    ['HEADWEAR', 'Posible gorra o sombrero', 'El sistema detectó una posible gorra o sombrero y el empleado indicó que no la usa.'],
    ['MASK', 'Posible cubrebocas', 'El sistema detectó un posible cubrebocas y el empleado indicó que no lo usa.'],
    ['SPOOF', 'Posible foto o pantalla', 'El anti-spoofing sugiere que las capturas podrían ser de una foto o una pantalla.'],
    ['DUPLICATE_FACE', 'Rostro ya registrado en otro empleado', 'El rostro se parece al registro aprobado de otro empleado de la empresa.'],
  ]),
};

/** Catálogos de prueba con sus búsquedas, como los entrega useCatalogs(). */
export const testCatalogs: CatalogApi = createCatalogApi(catalogsFixture);

/** Variante de los catálogos para un caso de prueba (p. ej. un registro inactivo). */
export const catalogsWith = (changes: Partial<Catalogs>): CatalogApi => createCatalogApi({ ...catalogsFixture, ...changes });
