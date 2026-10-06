/** Textos de pantallas del empleado (verificación, registro facial, mi QR) (es-MX). */
export default {
  /** "¿Cómo deseas identificarte?" (VerificationMenuPage). */
  menu: {
    eyebrow: 'Identificación',
    hello: 'Hola, {name}',
    helloAnonymous: 'Hola',
    question: '¿Cómo deseas identificarte?',
    face: 'VERIFICAR CON ROSTRO',
    faceLiveness: 'Reconocimiento facial con prueba de vida',
    faceOnly: 'Reconocimiento facial',
    start: 'Comenzar',
    qr: 'MOSTRAR MI QR',
    qrText: 'Muéstralo al validador: cambia cada {seconds} s y sirve una sola vez',
    show: 'Mostrar',
    footer: 'Identidad validada por tu empresa · Conexión protegida',
  },
  /** Verificación facial del propio empleado (FaceVerificationPage). */
  verify: {
    title: 'Verificación facial',
    submitting: 'Verificando tu identidad…',
    failed: 'No se pudo verificar tu identidad',
    showQr: 'Mostrar mi código QR',
  },
  /** Registro facial (EnrollmentPage). */
  enrollment: {
    title: 'Registro facial',
    tips: {
      light: 'Ubícate en un lugar bien iluminado.',
      front: 'Mira de frente a la cámara, con el rostro descubierto.',
    },
    rejected: {
      title: 'Tu registro anterior fue rechazado',
      /** `reason`: el motivo que escribió la empresa. */
      reason: 'Motivo: “{reason}”.',
      noReason: 'Tu empresa no pudo validar tu identidad con las capturas enviadas.',
    },
    reverify: {
      title: 'Verifica de nuevo tu identidad',
      eyebrow: 'Solicitud de tu empresa',
      step: 'Registra tu rostro con prueba de vida; toma alrededor de un minuto.',
    },
    confirm: {
      title: '¿Registrar tu rostro?',
      message: 'Se abrirá la cámara para capturar tu rostro con prueba de vida. Al terminar, tu empresa validará tu identidad.',
      replaces: 'Tu registro anterior se reemplazará por este.',
      open: 'Abrir cámara',
    },
    submitting: 'Enviando tu registro…',
    sent: {
      title: 'Registro enviado',
      text: 'Tu empresa validará tu identidad en breve.',
      offline: 'Tu empresa validará tu identidad en breve. La pantalla se actualizará al volver la conexión.',
    },
    fatal: 'No se pudo completar el registro',
    /** Etapas del escáner (cuatro o cinco) y cuánto toma. */
    duration_one: '{count} paso · 1 minuto',
    duration_other: '{count} pasos · 1 minuto',
    again: 'Registra tu rostro de nuevo',
    welcome: 'Bienvenido, {name}',
    intro: 'Para proteger tu identidad, registra tu rostro. Solo se hace una vez y tu empresa lo validará.',
    after: {
      title: 'Después: validación de tu empresa',
      text: 'Tu empresa revisa y aprueba tu identidad; verás el resultado en la app.',
    },
    before: 'Antes de comenzar:',
    privacy: 'Solo se guardan datos cifrados; nunca se comparten.',
    start: 'Comenzar registro',
  },
  /** Credencial digital: QR dinámico del empleado (MyQrPage). */
  myQr: {
    errorTitle: 'No se pudo generar tu código QR',
    alt: 'Código QR de {name}',
    eyebrow: 'Credencial digital',
    title: 'Mi código QR',
    intro: 'Muéstralo al validador para identificarte. Cambia cada {seconds} s y sirve una sola vez.',
    validated: 'Identidad validada',
    employeeNumber: 'No. de empleado {number}',
    enlarge: 'Mostrar en grande',
    another: 'Generar otro',
    brightness: 'Sube el brillo de tu pantalla para que se lea más rápido.',
    singleUse: 'Cada código sirve una sola vez y vence en segundos: una foto o captura de pantalla no sirve. No contiene tus datos personales ni biométricos.',
    brightnessLarge: 'Sube el brillo para que se lea al instante.',
  },
  /** En espera de que la empresa valide el registro facial (PendingValidationPage). */
  pending: {
    errorTitle: 'No se pudo actualizar el estado',
    title: 'Tu identidad está en validación',
    /** `name`: el primer nombre del empleado. */
    text: '{name}, tu registro facial se envió. Un administrador de tu empresa lo revisará; aquí verás cuando quede aprobado.',
    sent: {
      title: 'Registro facial enviado',
      text: 'Rostro, prueba de vida y calidad verificados.',
    },
    review: {
      title: 'Validación por tu empresa',
      text: 'Un administrador confirma que eres tú.',
    },
    access: {
      title: 'Acceso habilitado',
      text: 'Podrás identificarte con tu rostro o tu código QR.',
    },
    refresh: 'Actualizar estado',
    auto: 'Esta pantalla se actualiza automáticamente.',
  },
} as const;
