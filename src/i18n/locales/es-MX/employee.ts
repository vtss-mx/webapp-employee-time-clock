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
    /**
     * El indicador sobre el visor. Los pasos los pide el servidor y su NOMBRE sale del catálogo `enrollment_steps`
     * (decisión del dueño, 2026-10-08: el flujo es dinámico); «Listo» es el final del proceso, no un paso, así que su
     * texto sí es de la aplicación.
     */
    steps: {
      label: 'Paso {current} de {total}',
      done: 'Listo',
    },
    /** Mientras se guarda la foto inicial. */
    photoSaving: 'Guardando tu foto…',
    /**
     * El índice del registro: estado, aviso y botón de cada paso. El NOMBRE y la descripción de cada paso salen del
     * catálogo `enrollment_steps` (decisión del dueño, 2026-10-08: el ADMIN decide cuáles pasos y en qué orden).
     */
    index: {
      steps_one: '{count} paso',
      steps_other: '{count} pasos',
      resume: 'Hazlos en orden. Puedes salir después de cualquiera y continuar otro día: lo que hiciste se guarda.',
      errorTitle: 'No se pudo cargar tu registro',
      label: 'Pasos de tu registro',
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
        /** `step`: el nombre del paso que falta, del catálogo. */
        blocked: 'Primero completa «{step}».',
        exhausted: 'Se agotaron los intentos. Repite la foto inicial y las capturas.',
        unknown: 'Actualiza la aplicación para continuar con este paso.',
      },
      action: {
        photo: 'Tomar foto',
        retakePhoto: 'Repetir foto',
        captures: 'Iniciar capturas',
        video: 'Grabar video',
        resumeVideo: 'Continuar video',
        document: 'Subir documento',
        replaceDocument: 'Reemplazar documento',
      },
    },
    /** La pantalla de un paso que ahora no se puede abrir: qué pasa (su vacío) y de vuelta al índice. */
    blocked: {
      back: 'Volver al registro',
      blocked: {
        title: 'Falta un paso antes',
        text: 'Completa «{step}» para continuar con este paso.',
      },
      done: {
        title: 'Paso completado',
        text: 'Ya quedó listo. Continúa con el siguiente paso.',
      },
      disabled: {
        title: 'Paso no solicitado',
        text: 'Tu empresa no pide este paso de tu registro.',
      },
      exhausted: {
        title: 'Intentos agotados',
        text: 'Repite la foto inicial y las capturas para volver a intentarlo.',
      },
      unknown: {
        title: 'Paso no disponible',
        text: 'Actualiza la aplicación para continuar con este paso.',
      },
    },
    /** Un 409 del servidor: el paso ya no toca (lo bloquea otro o tu empresa dejó de pedirlo). */
    stepGone: 'Este paso ya no está disponible',
    /** Un paso que se cumple con un documento de identidad: cómo va y la pantalla para subirlo. */
    document: {
      pending: 'Falta subir tu documento.',
      done: 'Documento recibido · {date}',
      doneNoDate: 'Documento recibido.',
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
    /** El QR no puede generarse por una regla de la empresa (no un fallo pasajero): estado que lo explica. */
    unavailable: {
      qrTitle: 'QR no disponible',
      faceTitle: 'Registro facial pendiente',
    },
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
