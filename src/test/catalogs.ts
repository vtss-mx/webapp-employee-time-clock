import type { AntispoofLevelItem, CatalogItem, Catalogs, ConfidenceLevelItem, CountryItem, FaceErrorItem, ReasonItem } from '../types';
import { createCatalogApi, type CatalogApi } from '../utils/catalogs';
import { TAX_ID_TYPES } from './taxIdTypes';

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
  'FLASH_FLAT', 'REPLAY_PERCEPTUAL', 'KNOWN_ATTACK', 'RISK_DENIED', 'STEP_UP_REQUIRED',
];
const NOT_RETRYABLE = new Set(['FACE_NOT_REGISTERED', 'FACE_SERVICE_UNAVAILABLE', 'FACE_ALREADY_REGISTERED', 'FACE_LOCKED']);

export const catalogsFixture: Catalogs = {
  roles: rows([
    ['ADMIN', 'Administrador', 'Administrador de la plataforma: da de alta y administra empresas (no ve sus empleados).'],
    ['COMPANY', 'Empresa', 'Administrador de una empresa: gestiona sus empleados, validadores y política de verificación.'],
    ['EMPLOYEE', 'Empleado', 'Empleado: registra su rostro y se identifica con rostro o con su código QR.'],
    ['VALIDATOR', 'Validador', 'Validador de identidad: tableta o teléfono que identifica a los empleados de su empresa.'],
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
    ['WARNING', 'Advertencia', 'Solo historial: solicitudes rechazadas (4xx) registradas antes. Ya no se registran.', { tone: 'info' }],
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
  tax_id_types: TAX_ID_TYPES,
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
    ['POSSIBLE_DUPLICATE', 'Parecido con otro empleado', 'El rostro se parece al de otro empleado aprobado: revisa a los más parecidos antes de aprobar.'],
  ]),
  pricing_modes: rows([
    ['PER_USER', 'Por empleado activo', 'Cada empleado activo, día por día: quien entra o sale a mitad del periodo paga solo sus días.'],
    ['FLAT', 'Monto fijo', 'Un monto fijo por empresa, prorrateado por los días cobrables del periodo.'],
  ]),
  price_periods: rows([
    ['DAY', 'Por día', 'El precio es de un día.'],
    ['MONTH', 'Por mes', 'El precio es de un mes: cada día cuesta la parte que le toca de su mes.'],
    ['YEAR', 'Por año', 'El precio es de un año: cada día cuesta la parte que le toca de su año.'],
  ]),
  discount_types: rows([
    ['PERCENT', 'Porcentaje', 'Porcentaje del subtotal (hasta 100 %).'],
    ['AMOUNT', 'Monto fijo', 'Monto fijo por cargo (nunca mayor que el subtotal).'],
  ]),
  discount_recurrences: rows([
    ['ALWAYS', 'En todos los cargos', 'El descuento se aplica en cada cargo.'],
    ['FIRST', 'Solo en los primeros cargos', 'Se aplica en los primeros N cargos de la empresa.'],
    ['EVERY', 'Cada cierto número de cargos', 'Se aplica cada N cargos (el N-ésimo, el 2N-ésimo...).'],
  ]),
  billing_statuses: rows([
    ['ACTIVE', 'Activa', 'La empresa opera con normalidad.', { tone: 'success' }],
    ['SUSPENDED', 'Suspendida', 'Nadie de la empresa puede iniciar sesión ni operar hasta que se reactive.', { tone: 'danger' }],
  ]),
  suspension_reasons: rows([
    ['NON_PAYMENT', 'Falta de pago', 'Automática: un cargo siguió sin pagarse después de los días de gracia.'],
    ['MANUAL', 'Suspensión manual', 'La decidió el administrador de la plataforma, con su motivo.'],
  ]),
  charge_statuses: rows([
    ['OPEN', 'Por pagar', 'Tiene saldo pendiente.', { tone: 'warning' }],
    ['PAID', 'Pagado', 'Los pagos registrados cubren su total.', { tone: 'success' }],
    ['VOID', 'Anulado', 'Se anuló con su motivo: no se cobra y lo que se le había aplicado queda a favor.', { tone: 'muted' }],
  ]),
  payment_statuses: rows([
    ['CONFIRMED', 'Confirmado', 'El pago se registró y se aplicó a los cargos abiertos (lo que sobra queda a favor).', { tone: 'success' }],
    ['VOID', 'Anulado', 'Se anuló con su motivo: los cargos que cubría vuelven a quedar por pagar.', { tone: 'muted' }],
  ]),
  payment_methods: rows([
    ['TRANSFER', 'Transferencia', null],
    ['DEPOSIT', 'Depósito bancario', null],
    ['CASH', 'Efectivo', null],
    ['CARD', 'Tarjeta', null],
    ['CHECK', 'Cheque', null],
    ['OTHER', 'Otro', null],
  ]),
  currencies: rows([
    ['MXN', 'Peso mexicano', 'Pesos mexicanos (MXN). La moneda por omisión de la plataforma.', { symbol: '$', decimals: 2 }],
    ['USD', 'Dólar estadounidense', 'Dólares de Estados Unidos (USD). Para clientes del extranjero, el IVA suele ser 0 %.', { symbol: '$', decimals: 2 }],
    ['EUR', 'Euro', 'Euros (EUR). Para clientes del extranjero, el IVA suele ser 0 %.', { symbol: '€', decimals: 2 }],
  ]),
  storage_categories: rows([
    ['PEOPLE', 'Personal', 'Empleados, departamentos, validadores y sus dispositivos.'],
    ['BIOMETRICS', 'Biometría', 'Plantillas faciales cifradas, registros faciales y huellas de capturas.'],
    ['ATTENDANCE', 'Asistencia', 'Jornadas, descansos, registros, ausencias y la bitácora de identificaciones.'],
    ['SECURITY', 'Sesiones y seguridad', 'Sesiones de acceso y métricas de los intentos faciales.'],
    ['BILLING', 'Cobranza', 'Cargos, pagos y comprobantes.'],
  ]),
  slow_alert_statuses: rows([
    ['OPEN', 'Abierta', 'Nadie la ha atendido todavía (o volvió a ocurrir después de resolverse).', { tone: 'danger' }],
    ['ACKNOWLEDGED', 'En atención', 'Alguien ya la está revisando; si vuelve a ocurrir, sigue en atención.', { tone: 'warning' }],
    ['RESOLVED', 'Resuelta', 'Corregida. Si la ruta vuelve a tardar más del umbral, se reabre sola.', { tone: 'success' }],
  ]),
  // Antifraude (backend, migración 0062).
  fraud_kinds: rows([
    ['PRESENTATION', 'Presentación (foto, pantalla o máscara)', 'Una foto, una pantalla o una máscara frente a la cámara.'],
    ['INJECTION', 'Inyección (cámara virtual o programa)', 'Imágenes que no salen de la cámara.'],
    ['REPLAY', 'Reenvío de capturas', 'Capturas ya usadas o artefactos de un ataque conocido.'],
    ['LOCATION', 'Ubicación falsa', 'Ubicación simulada o poco creíble.'],
    ['BUDDY_PUNCHING', 'Suplantación entre compañeros', 'Una persona registra por otra.'],
    ['INTERNAL', 'Fraude interno', 'Abuso desde la empresa o un validador.'],
    ['MORPH', 'Rostro combinado (morphing)', 'Un registro facial que mezcla los rasgos de dos personas.'],
    ['OTHER', 'Otro', 'Riesgo alto sin un tipo claro.'],
  ]),
  signal_modes: rows([
    ['OFF', 'Apagada', 'La señal no se mide ni se registra.'],
    ['OBSERVE', 'Solo medir', 'Se mide y se registra con sus puntos, sin cambiar la decisión.'],
    ['ENFORCE', 'Obligatoria', 'Sus puntos cuentan para la decisión; si es una regla dura, niega el intento.'],
  ]),
  review_reasons: rows([
    ['CAPTURE', 'Captura poco confiable', 'La captura del rostro tuvo indicios de foto, pantalla o video.'],
    ['REPLAY', 'Captura repetida', 'La captura se parece demasiado a otra ya recibida.'],
    ['KNOWN_ATTACK', 'Coincide con un fraude conocido', 'La captura coincide con un intento de fraude ya confirmado.'],
    ['IDENTITY', 'Identidad poco clara', 'El rostro coincidió con poca holgura.'],
    ['CAMERA', 'Cámara poco confiable', 'La captura no informó de qué cámara venía.'],
    ['LOCATION', 'Ubicación poco confiable', 'La ubicación parece simulada o quedó en el límite del sitio.'],
    ['ACTIVITY', 'Actividad inusual en la empresa', 'La empresa recibe varios intentos sospechosos en este momento.'],
    // Antifraude 2b (backend, migración 0070): el registro no traía el código vigente del sitio.
    ['PRESENCE', 'Presencia sin confirmar', 'El registro no traía el código vigente del sitio.'],
  ]),
  risk_tiers: rows([
    ['LOW', 'Bajo', 'Sin señales que pesen.', { tone: 'success' }],
    ['MEDIUM', 'Medio', 'Algunas señales.', { tone: 'warning' }],
    ['HIGH', 'Alto', 'Señales fuertes.', { tone: 'danger' }],
    ['CRITICAL', 'Crítico', 'Señales muy fuertes.', { tone: 'danger' }],
  ]),
  risk_actions: rows([
    ['ALLOW', 'Permitir', 'El intento sigue normalmente.'],
    ['ALERT', 'Permitir y avisar', 'El intento sigue, pero se abre un caso.'],
    ['STEP_UP', 'Un paso más', 'Se pide un reto más exigente.'],
    ['REVIEW', 'En revisión', 'Se registra pendiente de la empresa.'],
    ['DENY', 'Negar', 'Se rechaza el intento.'],
  ]),
  attendance_review_statuses: rows([
    ['PENDING', 'En revisión', 'El registro se guardó, pero la empresa debe confirmarlo o rechazarlo.', { tone: 'warning' }],
    ['CONFIRMED', 'Confirmado', 'La empresa confirmó que el registro es válido.', { tone: 'success' }],
    ['REJECTED', 'Rechazado', 'La empresa rechazó el registro.', { tone: 'danger' }],
  ]),
  employee_device_modes: rows([
    ['OFF', 'Apagado', 'No se vincula el dispositivo del empleado.'],
    ['OBSERVE', 'Solo medir', 'Se registra desde qué dispositivo checa cada empleado.'],
    ['STEP_UP', 'Un paso más en un dispositivo nuevo', 'Un dispositivo nuevo pide un reto más exigente.'],
    ['APPROVAL', 'Aprobación de la empresa', 'Cada dispositivo nuevo lo debe aprobar la empresa.'],
  ]),
  policy_presets: rows([
    ['STANDARD', 'Estándar', 'Para la mayoría.'],
    ['HIGH', 'Alto', 'Más exigente.'],
    ['MAXIMUM', 'Máximo', 'Para sitios con fraude confirmado.'],
  ]),
  policy_change_statuses: rows([
    ['APPLIED', 'Aplicado', 'El cambio ya rige.', { tone: 'success' }],
    ['PENDING', 'Por aprobar', 'Relaja la seguridad: espera la aprobación de otro administrador.', { tone: 'warning' }],
    ['REJECTED', 'Rechazado', 'Otro administrador lo rechazó.', { tone: 'danger' }],
    ['CANCELLED', 'Cancelado', 'Quien lo pidió lo retiró, o venció.', { tone: 'muted' }],
  ]),
  fraud_case_statuses: rows([
    ['OPEN', 'Abierto', 'Nadie lo ha revisado todavía.', { tone: 'warning' }],
    ['IN_REVIEW', 'En revisión', 'Un administrador lo está revisando.', { tone: 'info' }],
    ['CONFIRMED', 'Fraude confirmado', 'Se confirmó el fraude.', { tone: 'danger' }],
    ['FALSE_POSITIVE', 'Falso positivo', 'No era fraude.', { tone: 'success' }],
    ['INCONCLUSIVE', 'No concluyente', 'No hay elementos para decidir.', { tone: 'muted' }],
  ]),
  fraud_case_event_kinds: rows([
    ['OPENED', 'Caso abierto', 'El sistema abrió el caso.'],
    ['STATUS_CHANGED', 'Cambio de estado', 'Un administrador cambió el estado del caso.'],
    ['NOTE', 'Nota', 'Un administrador agregó una nota.'],
    ['EVIDENCE_VIEWED', 'Evidencia consultada', 'Un administrador vio los fotogramas de evidencia.'],
    ['SIGNATURES_BLOCKED', 'Huellas bloqueadas', 'Las huellas del ataque pasaron a la lista de bloqueo.'],
    ['SIGNATURES_RELEASED', 'Huellas liberadas', 'Las huellas del caso salieron de la lista de bloqueo.'],
    ['LEARNING_FORGOTTEN', 'Aprendizaje olvidado', 'Se olvidó lo aprendido del empleado desde el intento.'],
  ]),
  // Documentos de una empresa (para su facturación).
  company_document_types: rows([
    ['TAX_CERTIFICATE', 'Constancia de situación fiscal', 'Constancia del SAT con el RFC, el régimen y el domicilio fiscal.'],
    ['INCORPORATION', 'Acta constitutiva', 'Escritura pública con la que se constituyó la empresa.'],
    ['PROOF_OF_ADDRESS', 'Comprobante de domicilio', 'Recibo reciente de luz, agua o teléfono.'],
    ['REPRESENTATIVE_ID', 'Identificación del representante legal', 'Credencial para votar, pasaporte o cédula de quien firma por la empresa.'],
    ['CONTRACT', 'Contrato', 'Contrato de servicio con la plataforma u otro acuerdo firmado.'],
    ['OTHER', 'Otro', 'Cualquier otro documento de la empresa.'],
  ]),
};

/** Catálogos de prueba con sus búsquedas, como los entrega useCatalogs(). */
export const testCatalogs: CatalogApi = createCatalogApi(catalogsFixture);

/** Variante de los catálogos para un caso de prueba (p. ej. un registro inactivo). */
export const catalogsWith = (changes: Partial<Catalogs>): CatalogApi => createCatalogApi({ ...catalogsFixture, ...changes });
