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
      replaces: 'Tu registro anterior se reemplazará por este.',
      replacesPhoto: 'Tu foto inicial anterior se reemplazará por esta.',
      open: 'Abrir cámara',
      photo: {
        title: '¿Tomar tu foto inicial?',
        message: 'Se abrirá la cámara para tomar una foto de tu rostro de frente. Se guarda cifrada para tu registro.',
      },
      captures: {
        title: '¿Iniciar las capturas?',
        message: 'Se abrirá la cámara para tomar {count} capturas de tu rostro y hacer la prueba de vida.',
      },
      video: {
        title: '¿Grabar el video?',
        message_one: 'Se abrirán la cámara y el micrófono para responder {count} pregunta en video.',
        message_other: 'Se abrirán la cámara y el micrófono para responder {count} preguntas en video.',
      },
    },
    submitting: 'Enviando tu registro…',
    sent: {
      title: 'Registro enviado',
      text: 'Tu empresa validará tu identidad en breve.',
      offline: 'Tu empresa validará tu identidad en breve. La pantalla se actualizará al volver la conexión.',
    },
    fatal: 'No se pudo completar el registro',
    again: 'Registra tu rostro de nuevo',
    welcome: 'Bienvenido, {name}',
    intro: 'Para proteger tu identidad, registra tu rostro. Solo se hace una vez y tu empresa lo validará.',
    after: {
      title: 'Después: validación de tu empresa',
      text: 'Tu empresa revisa y aprueba tu identidad; verás el resultado en la aplicación.',
    },
    before: 'Antes de comenzar:',
    privacy: 'Tus fotos, tu video y tu voz se guardan cifrados y solo los revisa tu empresa; nunca se comparten.',
    /** Los cuatro pasos del registro (decisión del dueño, 2026-10-06), en el indicador sobre el visor. */
    steps: {
      label: 'Paso {current} de {total}',
      photo: 'Foto inicial',
      captures: 'Capturas',
      video: 'Video',
      done: 'Listo',
    },
    /** Mientras se guarda la foto inicial (paso 1). */
    photoSaving: 'Guardando tu foto…',
    /** El índice de los pasos independientes (decisión del dueño, 2026-10-07): estado, aviso y botón de cada uno. */
    index: {
      steps_one: '{count} paso',
      steps_other: '{count} pasos',
      resume: 'Hazlos en orden. Puedes salir después de cualquiera y continuar otro día: lo que hiciste se guarda.',
      errorTitle: 'No se pudo cargar tu registro',
      label: 'Pasos del registro facial',
      photo: {
        title: 'Foto inicial',
        text: 'Una foto de tu rostro de frente, con buena luz.',
      },
      captures: {
        title: 'Capturas y prueba de vida',
        text: '{count} capturas de tu rostro y cuatro movimientos de la cabeza.',
      },
      video: {
        title: 'Video con preguntas',
        text: 'Responde en voz alta preguntas sobre tus datos, mirando a la cámara.',
      },
      state: {
        pending: 'Pendiente',
        done: 'Completado · {date}',
        complete: 'Completado',
        locked: 'Bloqueado',
        expired: 'Vencido',
        exhausted: 'Intentos agotados',
        answered: '{answered} de {total} respondidas',
      },
      hint: {
        validUntil: 'Sirve hasta el {date}',
        expired: 'Tu foto venció. Tómala de nuevo.',
        needsPhoto: 'Primero toma tu foto inicial.',
        needsCaptures: 'Primero completa las capturas.',
        exhausted: 'Se agotaron los intentos. Repite la foto inicial y las capturas.',
      },
      action: {
        photo: 'Tomar foto',
        retakePhoto: 'Repetir foto',
        captures: 'Iniciar capturas',
        video: 'Grabar video',
        resumeVideo: 'Continuar video',
      },
    },
    /** Una pantalla de un paso que se abrió fuera de orden: qué falta (su vacío). */
    blocked: {
      back: 'Volver al registro',
      photoUsed: {
        title: 'Foto inicial lista',
        text: 'Ya se usó en tus capturas. Continúa con el siguiente paso.',
      },
      needsPhoto: {
        title: 'Falta tu foto inicial',
        text: 'Toma tu foto inicial antes de las capturas.',
      },
      capturesDone: {
        title: 'Capturas listas',
        text: 'Ya se enviaron. Continúa con el siguiente paso.',
      },
      needsCaptures: {
        title: 'Faltan tus capturas',
        text: 'Completa las capturas antes del video.',
      },
      exhausted: {
        title: 'Intentos agotados',
        text: 'Repite la foto inicial y las capturas para volver a intentarlo.',
      },
      noVideo: {
        title: 'Sin video',
        text: 'Tu empresa no pide el video con preguntas.',
      },
    },
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
