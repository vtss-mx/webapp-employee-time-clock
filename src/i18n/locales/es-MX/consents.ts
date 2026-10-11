/**
 * Textos de la aplicación para el consentimiento biométrico (es-MX): la sección de Mi perfil, su pantalla y el
 * rescate del registro de identidad.
 *
 * El TEXTO LEGAL no está aquí: lo escribe el servidor (título y cinco párrafos) y se dibuja tal cual, en el idioma
 * de la petición, porque de él se guarda la huella como prueba de lo que la persona leyó (regla 22 de la raíz).
 */
export default {
  title: 'Datos biométricos',
  intro: 'Tu consentimiento para usar tu rostro y tu voz al verificar tu identidad.',
  loadError: 'No se pudo cargar tu consentimiento',
  granted: 'Otorgado',
  pending: 'Sin otorgar',
  askedBy: 'Tu empresa lo pide',
  grantedOn: 'Otorgado el {date}',
  revokedOn: 'Revocado el {date}',
  /** Versión del texto vigente: queda guardada con el consentimiento como prueba. */
  version: 'Versión {version}',
  read: 'Leer y otorgar',
  review: 'Ver el texto',
  revoke: 'Revocar',
  back: 'Volver a Mi perfil',
  /** Se llegó aquí desde un paso del registro de identidad. */
  backToEnrollment: 'Volver a tu registro',
  pageTitle: 'Consentimiento biométrico',
  pageSubtitle: 'Lee el texto completo y decide si lo otorgas',
  grant: 'Otorgar mi consentimiento',
  empty: {
    title: 'Sin consentimientos',
    description: 'Aquí verás lo que tu empresa te pide autorizar.',
  },
  /** Mi perfil es de todos los roles; los datos biométricos solo son de un empleado. */
  onlyEmployees: {
    title: 'Solo para empleados',
    description: 'Tu cuenta no guarda datos biométricos.',
  },
  grantAsk: {
    eyebrow: 'Tu consentimiento',
    title: '¿Otorgar tu consentimiento?',
    message: 'Confirmas que leíste el texto completo y que autorizas lo que dice.',
    note: 'Puedes revocarlo cuando quieras desde Mi perfil.',
    confirm: 'Otorgar',
  },
  grantFailed: 'No se pudo otorgar tu consentimiento',
  grantedTitle: 'Consentimiento otorgado',
  revokeAsk: {
    eyebrow: 'Tu consentimiento',
    title: '¿Revocar tu consentimiento biométrico?',
    message: 'Tu rostro, tus fotos y tu voz se borran de inmediato y tu registro facial deja de existir.',
    note: 'No se puede deshacer. Tu empresa tendrá que verificar tu identidad de otra forma.',
    confirm: 'Revocar',
  },
  revokeFailed: 'No se pudo revocar tu consentimiento',
  revokedTitle: 'Consentimiento revocado',
  revokedText: 'Tus datos biométricos se borraron.',
  /** El servidor detuvo un paso del registro por falta de consentimiento (403). */
  missingTitle: 'Falta tu consentimiento',
  /** Registro en persona: quien opera la cámara no puede otorgar el consentimiento del empleado. */
  inPersonTitle: 'Falta el consentimiento de {name}',
  inPersonText: 'Debe otorgarlo desde Mi perfil para registrar su rostro.',
} as const;
