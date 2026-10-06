/**
 * Textos de política de verificación y ajustes de la prueba de vida de una empresa (es-MX): la
 * pantalla del ADMIN (`CompanyPolicyPage`), sus interruptores por sección y sus confirmaciones. Los
 * ajustes de los candados viven en `./policy/tuning`. Los accesorios (nombre y frase) vienen del
 * catálogo del backend.
 */
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

export default {
  loadError: 'No se pudo cargar la política de verificación',
  title: 'Política de verificación de identidad',
  saveError: 'No se pudo guardar',
  /** Insignia de las protecciones que conviene mantener encendidas. */
  recommended: 'Recomendado',
  /** Al pie de cada confirmación: a quién aplica el cambio. */
  appliesTo: 'Aplica en segundos a todo el personal de {company}.',
  confidence: {
    title: 'Nivel de confianza',
    intro: 'Probabilidad mínima de que la persona frente a la cámara sea el empleado registrado.',
    /** `{lead}` va en negritas: `identifyLead`. */
    identifyIntro:
      '{lead} (validadores): puedes exigir más, porque buscar entre muchos aumenta las coincidencias falsas. Nunca rige por debajo del nivel anterior.',
    identifyLead: 'Al identificar entre todos los empleados',
    identifyLabel: 'Nivel de confianza para identificar entre todos',
    saved: 'Nivel de confianza actualizado',
    savedText: 'Se exigirá {value} en cada verificación facial.',
    identifySaved: 'Confianza para identificar actualizada',
    identifySavedText: 'Los validadores exigirán {value} al identificar entre todos los empleados.',
  },
  sections: {
    face: {
      title: 'Requisitos del rostro',
      hint: 'Qué debe retirarse la persona antes de escanear. Cubrir el rostro reduce la precisión.',
    },
    security: {
      title: 'Seguridad',
      hint: 'Protecciones contra la suplantación de identidad; conviene mantenerlas activas.',
    },
    locks: {
      title: 'Candados contra suplantación',
      hint: 'Cada candado bloquea una forma distinta de engañar al reconocimiento facial; conviene mantenerlos todos activos.',
    },
    learning: {
      title: 'Aprendizaje continuo',
      hint: 'Cada identificación segura enseña cómo luce hoy cada empleado. Las muestras que validó la empresa nunca se reemplazan.',
    },
    location: {
      title: 'Ubicación de la asistencia',
      hint: 'Cada registro de asistencia lleva la ubicación del teléfono y la hora del servidor; ajusta abajo la precisión y la velocidad.',
    },
    methods: {
      title: 'Métodos de identificación',
      hint: 'Formas en que los empleados pueden identificarse.',
    },
    antifraud: {
      title: 'Antifraude',
      hint: 'Ante la duda, el motor pide un paso más o deja el registro en revisión de la empresa. La evidencia de los intentos sospechosos solo la ve el administrador en «Casos de fraude».',
    },
    capture: {
      title: 'Protocolo de captura',
      hint: 'Pruebas en tiempo real contra videos inyectados. Por ahora solo miden.',
    },
    devices: {
      title: 'Dispositivos de los validadores',
      hint: 'Solo los validadores tienen restricciones; empleados y administradores usan cualquier dispositivo.',
    },
  },
  /** Un interruptor por accesorio del catálogo: "Retirar los lentes" (`{phrase}` sale del catálogo). */
  accessories: {
    remove: 'Retirar {phrase}',
    blockGlasses: {
      on: 'Se pedirá quitarse lentes (incluidos los de sol).',
      off: 'Se permite identificarse con lentes.',
    },
    blockHeadwear: {
      on: 'Se pedirá quitarse gorras, sombreros y viseras (salvo empleados exentos por motivos religiosos o médicos).',
      off: 'Se permite identificarse con prendas en la cabeza.',
    },
    blockMask: {
      on: 'Se pedirá quitarse el cubrebocas (verificación física de nariz y mejillas).',
      off: 'Se permite identificarse con cubrebocas (menor precisión).',
    },
  },
  /** Cada regla: su nombre y qué pasa encendida (`on`) o apagada (`off`). */
  options: {
    livenessChallenge: {
      label: 'Prueba de vida',
      on: 'La persona hace movimientos de cabeza al azar.',
      off: 'Sin reto de movimientos.',
    },
    antiSpoofing: {
      label: 'Anti-spoofing',
      on: 'Detecta fotos impresas, pantallas y videos frente a la cámara.',
      off: 'No se analizan fotos ni pantallas.',
    },
    blockVirtualCameras: {
      label: 'Bloquear cámaras virtuales',
      on: 'Se rechazan programas que se hacen pasar por cámara (OBS, ManyCam…).',
      off: 'Se acepta cualquier cámara, incluidas las virtuales.',
    },
    rejectForeignImages: {
      label: 'Solo capturas en vivo',
      on: 'Se rechazan imágenes de la galería o editadas.',
      off: 'Se aceptan imágenes de la galería o editadas.',
    },
    detectStaticCaptures: {
      label: 'Detectar fotos fijas',
      on: 'Se rechaza un intento si sus capturas son idénticas (una foto enviada varias veces).',
      off: 'No se comparan las capturas entre sí.',
    },
    detectReplays: {
      label: 'Detectar capturas reutilizadas',
      on: 'Cada captura sirve una sola vez: reenviar capturas guardadas o interceptadas se rechaza.',
      off: 'No se recuerdan las capturas recibidas.',
    },
    checkCaptureContinuity: {
      label: 'Exigir una sola toma',
      on: 'Todas las capturas deben salir de la misma cámara, con el rostro y la luz continuos al girar.',
      off: 'No se compara la cámara, el encuadre ni la luz entre capturas.',
    },
    enforceHumanTiming: {
      label: 'Tiempo humano en la prueba de vida',
      on: 'Se rechazan respuestas al reto más rápidas de lo que tarda una persona (programas automáticos).',
      off: 'No se mide cuánto tarda la respuesta al reto.',
    },
    detectDuplicateFaces: {
      label: 'Detectar rostros duplicados',
      on: 'Al registrar un rostro ya aprobado en otro empleado: se marca para revisión o, en persona, se bloquea.',
      off: 'No se compara el registro con los demás empleados.',
    },
    lockoutEnabled: {
      label: 'Bloqueo por intentos fallidos',
      on: 'Tras varios intentos fallidos o sospechosos seguidos se bloquea temporalmente (ajústalo abajo).',
      off: 'Se puede intentar sin límite (solo el límite general de peticiones).',
    },
    adaptiveLearning: {
      label: 'Aprender de cada identificación segura',
      on: 'Aprende solo de identificaciones con prueba de vida y confianza holgada (otra luz, cámara, peinado o barba).',
      off: 'Cada empleado se compara solo con las muestras de su registro aprobado.',
    },
    detectImpossibleTravel: {
      label: 'Detectar viajes imposibles',
      on: 'Se rechaza un registro demasiado lejos del anterior para el tiempo transcurrido (ubicación falsa o cuenta compartida).',
      off: 'No se compara la ubicación de un registro con la del anterior.',
    },
    qrEnabled: {
      label: 'Verificación con código QR',
      on: 'Los empleados muestran en su teléfono un QR dinámico: cambia solo y cada código sirve una sola vez.',
      off: 'Solo reconocimiento facial.',
    },
    validatorDeviceApproval: {
      label: 'Autorizar dispositivos de validadores',
      on: 'Cada tableta o teléfono de un validador queda por autorizar en Validadores › Dispositivos.',
      off: 'Los validadores pueden iniciar sesión en cualquier dispositivo con su correo y contraseña.',
    },
    qrOnlyAttendance: {
      label: 'Asistencia con el QR solo',
      on: 'Un validador en modo QR registra la entrada y la salida con el código, sin rostro.',
      off: 'Con el QR solo se identifica; para registrar la asistencia hace falta el rostro.',
    },
    riskEngine: {
      label: 'Motor de riesgo',
      on: 'Cada intento se califica con sus señales y se decide según el nivel de riesgo (ajústalo abajo).',
      off: 'Solo deciden los candados; las señales no se suman.',
    },
    flashPaced: {
      label: 'Destello dictado por el servidor',
      on: 'Cada color se revela en el momento: nadie puede preparar las capturas.',
      off: 'Los colores se envían con el reto.',
    },
    captureBurst: {
      label: 'Ráfaga de recortes del rostro',
      on: 'Se envían unos segundos de recortes para medir movimiento natural y continuidad.',
      off: 'Solo se envían las capturas sueltas.',
    },
    fraudEvidence: {
      label: 'Guardar evidencia de los intentos sospechosos',
      on: 'Se guardan unos fotogramas cifrados de cada intento sospechoso para revisar el caso; se borran solos al vencer.',
      off: 'Los casos se abren sin fotogramas: solo con lo que se midió.',
    },
    validatorMobileOnly: {
      label: 'Validadores solo desde tableta o teléfono',
      on: 'Los validadores solo inician sesión en tabletas y teléfonos.',
      off: 'Los validadores también pueden operar desde una computadora con cámara.',
    },
  },
  /** Advertencia al apagar una protección (por omisión, la de suplantación de identidad). */
  warnings: {
    spoofing: 'Esto reduce la protección contra suplantación de identidad (fotos, pantallas o videos).',
    impossibleTravel: 'Un registro con una ubicación falsa o desde otro lugar no se detectará por la distancia.',
    deviceApproval: 'Cualquier persona con el correo y la contraseña de un validador podrá operar desde cualquier dispositivo.',
    mobileOnly: 'Los validadores podrán operar desde computadoras, cuya cámara suele ser más fácil de engañar con fotos o pantallas.',
    qrOnly: 'Quien tenga el teléfono de otro empleado podrá registrar su asistencia sin mostrar el rostro.',
    riskEngine: 'Las señales dejarán de sumarse: un intento con varios indicios de engaño pasará si ningún candado lo detiene solo.',
    captureProtocol: 'Un video preparado de antemano será más difícil de detectar.',
  },
  /** Encender o apagar una regla: confirmación y aviso. */
  toggle: {
    eyebrow: 'Política de verificación',
    eyebrowSecurity: 'Protección recomendada',
    activateTitle: '¿Activar «{label}»?',
    deactivateTitle: '¿Desactivar «{label}»?',
    on: 'Activado',
    off: 'Desactivado',
    activate: 'Activar',
    deactivate: 'Desactivar',
    activated: '{label}: activado',
    deactivated: '{label}: desactivado',
  },
  tuning,
  ...antifraud,
} as const;
