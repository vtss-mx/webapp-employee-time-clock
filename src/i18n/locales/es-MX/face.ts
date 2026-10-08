/** Textos de cámara, registro y verificación facial, prueba de vida y destello (es-MX). */
export default {
  /** Visor de la cámara (CameraCapture, useCamera). */
  camera: {
    name: 'Cámara',
    kinds: {
      front: 'Cámara frontal',
      back: 'Cámara trasera',
      unknown: 'Cámara',
    },
    /** Lente de una cámara del equipo (el sistema la nombra en su idioma: «Back Ultra Wide Camera»). */
    lenses: {
      wide: 'gran angular',
      ultraWide: 'ultra gran angular',
      telephoto: 'teleobjetivo',
      dual: 'dual',
      triple: 'triple',
    },
    /** Cámara del equipo con su lente: "Cámara trasera (ultra gran angular)". */
    withLens: '{camera} ({lens})',
    /** Varias cámaras del mismo tipo: "Cámara trasera 2". */
    numbered: '{name} {number}',
    preview: 'Vista previa de la cámara',
    requesting: 'Activando la cámara…',
    request: {
      user: 'La cámara frontal se usará unos segundos para verificar tu identidad.',
      environment: 'La cámara se usará unos segundos para leer el código QR.',
    },
    permissionHint: 'Si tu navegador lo solicita, elige «Permitir». La cámara solo se usa durante este proceso.',
    paused: 'Cámara en pausa',
    activate: 'Activar cámara',
    switch: 'Cambiar cámara',
    select: 'Seleccionar cámara',
    openSecure: 'Abrir versión segura',
    notReady: 'La cámara aún no está lista',
    processFailed: 'No se pudo procesar la imagen',
    captureFailed: 'No se pudo capturar la imagen',
    /** El teléfono giró a media toma: la imagen cambió de tamaño y el servidor exige una sola toma (se repite). */
    turned: 'La cámara cambió de orientación. Mantén el teléfono en la misma posición.',
  },
  /** Por qué no se pudo abrir la cámara y cómo resolverlo (cameraDiagnostics). */
  cameraHelp: {
    /** En lugar del nombre de un navegador que no se reconoce. */
    yourBrowser: 'tu navegador',
    pressRetry: 'Pulsa "Reintentar".',
    insecure: {
      title: 'La cámara necesita una conexión segura',
      message: 'Los navegadores solo permiten usar la cámara en páginas HTTPS (o en localhost).',
      openSecure: 'Abre la versión segura con el botón de abajo.',
      certificate: 'Si aparece un aviso de certificado (red local), elige "Avanzado" → "Continuar".',
      useHttps: 'Entra a la aplicación con una dirección https://.',
    },
    unsupported: {
      title: 'Tu navegador no permite usar la cámara',
      message: 'Usa la versión más reciente de Chrome, Edge, Safari o Firefox.',
      update: 'Actualiza tu navegador o abre la aplicación en otro.',
    },
    denied: {
      title: 'El permiso de cámara está bloqueado',
      message: '{browser} o el sistema no permiten que esta página use la cámara.',
    },
    /** Permiso del sitio en la barra de direcciones, por navegador. */
    site: {
      chrome: 'En la barra de direcciones haz clic en el ícono de cámara o del candado → Cámara → "Permitir".',
      edge: 'En la barra de direcciones haz clic en el candado → Permisos de este sitio → Cámara → "Permitir".',
      firefox: 'Haz clic en el ícono de cámara tachada junto a la dirección y quita el bloqueo.',
      safariIos: 'Toca "aA" en la barra de direcciones → Ajustes del sitio web → Cámara → "Permitir".',
      safariMac: 'En Safari: menú Safari → Ajustes → Sitios web → Cámara → elige "Permitir" para este sitio.',
      other: 'Abre los permisos del sitio (ícono junto a la dirección) y permite la cámara.',
    },
    /** Permiso del sistema operativo para el navegador. */
    system: {
      macos: 'En la Mac: menú Apple → Ajustes del Sistema → Privacidad y seguridad → Cámara → activa {browser}. Después cierra y vuelve a abrir {browser}.',
      windows: 'En Windows: Configuración → Privacidad y seguridad → Cámara → activa "Acceso a la cámara" y "Permitir que las aplicaciones de escritorio accedan a la cámara".',
      ios: 'En el iPhone/iPad: Ajustes → {browser} → Cámara → "Permitir".',
      android: 'En Android: Ajustes → Aplicaciones → {browser} → Permisos → Cámara → "Permitir".',
    },
    notFound: {
      title: 'No se detectó ninguna cámara',
      message: 'El sistema no reporta una cámara disponible para el navegador.',
      antivirus:
        'Si tu equipo tiene antivirus o control corporativo (p. ej. Kaspersky → "Protección de cámara web"), puede estar bloqueando la cámara: desactívalo o agrega tu navegador como excepción.',
      macCheck: 'Verifica que la Mac detecte la cámara: menú Apple → Acerca de esta Mac → Más información → Informe del sistema → Cámara.',
      /** `antivirus` es el texto anterior, ya en minúscula inicial. */
      noCameraListed: 'Si no aparece ninguna cámara: {antivirus}',
      macNoBuiltIn:
        'En Mac mini, Mac Studio o una MacBook con la tapa cerrada no hay cámara integrada disponible: conecta una cámara USB o usa la cámara de Continuidad del iPhone.',
      windowsDevices: 'Revisa el Administrador de dispositivos → Cámaras (debe aparecer sin errores).',
      windowsSwitch: 'Algunas computadoras portátiles tienen un interruptor o una tecla (F8, F10 o con ícono de cámara) que la apaga.',
      generic: 'Verifica que el dispositivo tenga una cámara conectada y habilitada.',
    },
    busy: {
      title: 'No se pudo iniciar la cámara',
      message: 'Otra aplicación la está usando o algo la bloquea.',
      closeApps: 'Cierra Zoom, Teams, Meet, FaceTime u otra pestaña que esté usando la cámara.',
      antivirus: 'Si persiste, un antivirus puede estar bloqueándola (p. ej. Kaspersky → "Protección de cámara web").',
    },
    unknown: {
      title: 'No se pudo iniciar la cámara',
      message: 'Ocurrió un problema inesperado al abrir la cámara.',
      reload: 'Recarga la página y pulsa "Reintentar".',
      otherBrowser: 'Si continúa, prueba con otro navegador.',
    },
    /** El navegador integrado de otra aplicación (Facebook, Instagram, TikTok...) no deja usar la cámara. */
    inApp: {
      title: 'Abre esta página en tu navegador',
      message: 'El navegador integrado de esta aplicación no permite usar la cámara.',
      ios: 'Toca el menú (⋯ o el ícono de compartir) y elige «Abrir en Safari» o «Abrir en el navegador».',
      android: 'Toca el menú (⋮) y elige «Abrir en Chrome» o «Abrir en el navegador».',
      copyLink: 'Si no aparece esa opción, copia el enlace y pégalo en tu navegador.',
    },
    /** El navegador altera la imagen de los lienzos para evitar el rastreo (utils/canvasReadback.ts). */
    canvasBlocked: {
      title: 'Tu navegador oculta la imagen de la cámara',
      message: 'Su protección contra el rastreo cambia la imagen y no se puede verificar tu rostro.',
      allow: 'Permite que este sitio lea los datos del lienzo en la configuración de privacidad de tu navegador.',
      otherBrowser: 'O abre la aplicación en Chrome, Edge, Safari o Firefox con su configuración normal.',
    },
  },
  /** Guía de la detección en vivo sobre la cámara (useFaceDetection). */
  guidance: {
    loading: 'Preparando la detección facial…',
    noFace: 'Coloca tu rostro en la guía',
    multiple: 'Solo una persona frente a la cámara',
    /** El rostro asoma fuera del cuadro (o lo tapa algo): no está completo. */
    cutOff: 'Muestra tu rostro completo',
    tooFar: 'Acércate',
    tooClose: 'Aléjate',
    offCenter: 'Centra tu rostro',
    lookStraight: 'Mira al frente',
    tooDark: 'Más luz',
    tooBright: 'Evita la luz directa',
    move: 'Haz el movimiento que se indica',
    holdStill: 'Mantente quieto',
    ready: 'Rostro detectado',
  },
  detection: {
    timeout: 'Tiempo de carga del detector agotado',
  },
  /** Etapas visibles del escáner (FaceScan): nombre, título e indicación. */
  stages: {
    prepare: {
      name: 'Preparación',
      title: 'Mira hacia la cámara',
      text: 'Mantén el rostro visible con buena iluminación.',
    },
    align: {
      name: 'Alineación',
      title: 'Centra tu rostro',
      text: 'Colócalo dentro de la guía y mira a la cámara.',
    },
    scan: {
      name: 'Escaneo',
      title: 'Mantente quieto',
      text: 'Mira al frente mientras se completa el escaneo.',
    },
    liveness: {
      name: 'Prueba de vida',
      title: 'Sigue la indicación',
      text: 'Mueve la cabeza como se indique hasta completar cada paso.',
    },
    confirm: {
      name: 'Confirmación',
      title: 'Confirmando tu identidad',
      text: 'Espera la confirmación antes de continuar.',
    },
  },
  scan: {
    stagesLabel: 'Etapas del escaneo',
    counter: 'Etapa {current} de {total}',
  },
  /** Mensajes del flujo facial guiado (LiveFaceFlow, liveFaceView). */
  flow: {
    holdPosition: 'Mantén la posición',
    almost: 'Un poco más',
    /** La cuenta bajo la indicación mientras se toman las fotos de frente. */
    photo: 'Foto {current} de {total}',
    analyzing: 'Analizando…',
    retry: 'Intenta de nuevo',
    nextStepReady: 'Listo para el siguiente paso',
    /** De vuelta al frente entre movimientos (y al final del registro, que termina centrado). */
    lookFront: 'Centra tu rostro',
    centered: 'Rostro centrado',
    manualOnly: 'Detección automática no disponible. Usa «Capturar».',
    virtualCamera: 'Cámara virtual no permitida: elige la cámara del dispositivo',
    blockedText: 'Corrige lo que se indica en la cámara; el escaneo se reanuda solo.',
    stepTitle: '{name} · paso {current} de {total}',
    recenterText: 'Vuelve a mirar al frente para el siguiente paso.',
    recenterEndText: 'Centra tu rostro para terminar.',
    timeout: 'No se completó el movimiento a tiempo. Hazlo despacio hasta llenar el anillo.',
    challengeRestart: 'No se completó la prueba de vida. El escaneo empezará de nuevo.',
    capture: 'Capturar',
    /** Anillo de las fotos (lectores de pantalla): `percent` ya trae su formato («33 %»). */
    ring: 'Captura al {percent}',
    /** Marca ✓ bajo el círculo: se tomaron todas las fotos. */
    captureDone: 'Captura completa',
    /** La cuenta del registro facial: solo las fotos VÁLIDAS (decisión del dueño, 2026-10-06). */
    validPhotos: 'Capturas válidas: {percent}',
  },
  /** Guía por voz del registro facial (decisión del dueño, 2026-10-08): lo que se lee en voz alta en cada paso. */
  speak: {
    position: 'Coloca tu rostro dentro de la guía y mira al frente.',
    recenter: 'Vuelve a mirar al frente.',
    done: 'Listo. Procesando.',
    /** Aviso del botón de silencio del encabezado (lectores de pantalla). */
    mute: 'Silenciar la guía por voz',
    unmute: 'Activar la guía por voz',
    /** Lo que lee «Probar voz» en la política del ADMIN. */
    sample: 'Así se oye la guía por voz.',
  },
  /** Recordatorio antes de la captura (FaceRequirements): nunca pide retirar un accesorio (decisión del dueño, 2026-10-07). */
  requirements: {
    label: 'Requisitos para la captura',
    lighting: 'Buena iluminación',
    realFace: 'Tu rostro real, sin fotos',
  },
  /** Insignias sobre el rostro con los accesorios que el servidor detectó (el único aviso de un accesorio). */
  accessories: {
    detected: 'Accesorios detectados',
  },
  /** Nivel de confianza del reconocimiento facial (ConfidenceSlider). */
  confidence: {
    label: 'Nivel de confianza requerido',
    /** "99 % (Estricto)": el nombre del nivel viene del catálogo. */
    level: '{value} ({name})',
    current: 'Vigente',
    similarity: 'Similitud exigida',
    impostors: 'Impostores aceptados',
    noImpostors: '0 de 3 000',
    rejections: 'Rechazos de una captura legítima',
    reset: 'Restablecer',
    save: 'Guardar nivel',
    moveHint: 'Mueve el control para elegir otro nivel',
    eyebrow: 'Nivel de confianza',
    confirmTitle: '¿Exigir {value} de confianza?',
    lower: 'Un nivel más bajo acepta con más facilidad a una persona parecida: habrá menos reintentos, pero menos seguridad.',
    strict: 'Es el nivel más estricto: aumenta la seguridad, pero habrá más reintentos.',
    higher: 'Un nivel más alto protege mejor contra personas parecidas.',
    beforeRequiring: 'Antes de exigirlo',
    withLevel: 'Con este nivel',
    maxCalibrated: 'Ningún sistema biométrico puede garantizar el 100 %: se aplica el máximo calibrado, {value}.',
    retries: 'Aproximadamente {rate} de las capturas legítimas no alcanzan el nivel y se repiten.',
    tips: 'Pide a los empleados buena iluminación y mirar de frente a la cámara.',
    note: 'Aplica en segundos a todas las verificaciones faciales de la empresa.',
  },
  /** Reconocimiento evolutivo en la política de una empresa (FaceLearningPanel, solo el ADMIN). */
  learning: {
    title: 'Reconocimiento facial evolutivo',
    errorTitle: 'No se pudo cargar la evolución del reconocimiento',
    learning: 'Aprendiendo',
    paused: 'En pausa',
    intro:
      'Cada identificación segura (con prueba de vida y confianza holgada) enseña al sistema cómo luce hoy cada empleado; lo aprendido que deja de servir se reemplaza solo. Las muestras que validó la empresa nunca se reemplazan.',
    employees: 'Empleados que ya aprenden',
    samples: 'Muestras aprendidas',
    resolved: 'Identificaciones resueltas por lo aprendido',
    last: 'Último aprendizaje {ago} · {learning} de {approved} empleados con rostro aprobado.',
    never: 'Aún no aprende: lo hará con las primeras identificaciones seguras de sus empleados.',
    pausedTitle: 'El aprendizaje continuo está en pausa',
    pausedText:
      'Sus empleados se comparan solo con su registro aprobado. Activa «Aprendizaje continuo» en esta política para que el reconocimiento mejore con el uso.',
  },
} as const;
