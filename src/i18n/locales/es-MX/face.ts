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
      windowsSwitch: 'Algunas laptops tienen un interruptor o una tecla (F8, F10 o con ícono de cámara) que la apaga.',
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
  },
  /** Guía de la detección en vivo sobre la cámara (useFaceDetection). */
  guidance: {
    loading: 'Preparando la detección facial…',
    noFace: 'Coloca tu rostro dentro de la silueta',
    multiple: 'Solo una persona frente a la cámara',
    tooFar: 'Acércate un poco',
    tooClose: 'Aléjate un poco',
    offCenter: 'Centra tu rostro en la silueta',
    lookStraight: 'Mira directamente a la cámara',
    tooDark: 'Busca un lugar con más luz',
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
      text: 'Colócalo dentro de la silueta y mira a la cámara.',
    },
    scan: {
      name: 'Escaneo',
      title: 'Mantente quieto',
      text: 'Mira al frente mientras se completa el escaneo.',
    },
    liveness: {
      name: 'Prueba de vida',
      title: 'Sigue la indicación',
      text: 'Mueve la cabeza como se indique; la pantalla puede cambiar de color un instante.',
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
    lookFront: 'Vuelve a mirar al frente',
    manualOnly: 'Detección automática no disponible. Usa «Capturar».',
    virtualCamera: 'Cámara virtual no permitida: elige la cámara del dispositivo',
    blockedText: 'Corrige lo que se indica en la cámara; el escaneo se reanuda solo.',
    /** `name`: el nombre de la etapa ("Prueba de vida"). */
    flashTitle: '{name} · destello',
    flashText: 'Mantén tu rostro frente a la pantalla mientras cambia de color.',
    stepTitle: '{name} · paso {current} de {total}',
    recenterText: 'Vuelve a mirar al frente para el siguiente paso.',
    timeout: 'No se completó el movimiento a tiempo. Hazlo despacio hasta llenar el anillo.',
    flashFailed: 'No se pudo completar el destello de colores. Mantén la pantalla encendida y tu rostro frente a ella.',
    challengeRestart: 'No se completó la prueba de vida. El escaneo empezará de nuevo.',
    capture: 'Capturar',
    /** Anillo de las fotos (lectores de pantalla): `percent` ya trae su formato («33 %»). */
    ring: 'Captura al {percent}',
    /** Marca ✓ bajo el círculo: se tomaron todas las fotos. */
    captureDone: 'Captura completa',
  },
  /** Destello de colores de la prueba de vida (FlashOverlay). */
  flash: {
    hint: 'Mantén tu rostro frente a la pantalla',
    progress: 'Color {current} de {total}',
    interrupted: 'El destello de colores se interrumpió',
  },
  /** El sistema insiste en un accesorio que el empleado no usa: enviar el registro a revisión. */
  review: {
    /** Une las frases de los accesorios del catálogo: "los lentes ni la gorra". */
    nor: 'ni',
    question: '¿No estás usando {names}?',
    explanation: 'Puede deberse a la luz o al encuadre. Si estás seguro, envía tu registro a revisión: tu empresa revisará tu fotografía.',
    confirm: 'No uso {names} · enviar a revisión',
    sent: 'Tu registro se enviará a revisión de tu empresa.',
  },
  /** Lo que exige la empresa antes de la captura (FaceRequirements). */
  requirements: {
    label: 'Requisitos para la captura',
    /** `name`: el accesorio del catálogo, en minúsculas. */
    without: 'Sin {name}',
    lighting: 'Buena iluminación',
    realFace: 'Tu rostro real, sin fotos',
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
