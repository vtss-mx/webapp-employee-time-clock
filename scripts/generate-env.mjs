#!/usr/bin/env node
/**
 * Genera el `.env` COMPLETO de la webapp: todas las variables VITE_* con su valor por defecto y su comentario.
 *
 *   node scripts/generate-env.mjs > .env      # instalación nueva (luego llena las claves de Google)
 *
 * Decisión del dueño del producto: toda la configuración base vive en el `.env` de cada proyecto, a la vista,
 * con su valor y qué hace. Es el mismo enfoque del backend (`scripts/generate_secrets.py`): un generador en el
 * repositorio en lugar de una plantilla `.env.example`. Las claves (Google Maps, Firebase) salen VACÍAS: nunca se
 * suben al repositorio; se copian de la consola de Google al `.env` (que está en .gitignore).
 *
 * Cada valor es el mismo de `src/utils/config.ts` (o de `vite.config.ts`): `src/utils/envFile.test.ts` verifica
 * que aquí esté cada variable que lee el código (y ninguna más), que cada valor sea el del código, que las
 * claves salgan vacías y que el `.env` local tenga exactamente estas variables.
 */

const range = (min, max, unit = '') => `Rango: ${min} a ${max}${unit}.`;
const bool = 'Valores: true | false.';

/** [grupo, [[variable, valor por defecto, comentario], ...]] en el orden de src/utils/config.ts. */
const SECTIONS = [
  [
    'Aplicación',
    [
      ['VITE_APP_NAME', 'Employee Time Clock', 'Nombre de la aplicación (login, encabezados y título de la pestaña).'],
      ['VITE_APP_TAGLINE', 'Control de asistencia y jornada laboral.', 'Lema del HTML inicial en español (título y descripción de la pestaña mientras carga la app; ya cargada, se usa el lema del idioma activo).'],
      [
        'VITE_VERSION_CHECK_SECONDS',
        '60',
        'Cada cuánto se revisa si se publicó una versión nueva (también al cambiar de pantalla y al volver a la ' +
          `pestaña). En el login recarga sola; en otras pantallas pregunta. ${range(15, 3600, ' s')}`,
      ],
    ],
  ],
  [
    'API',
    [
      ['VITE_API_URL', '/api', '/api = mismo origen (Nginx en Docker o el proxy de Vite en desarrollo). Recomendado.'],
      ['VITE_API_TIMEOUT_SECONDS', '30', `Tiempo límite de cada petición. ${range(5, 300, ' s')}`],
      [
        'VITE_API_UPLOAD_TIMEOUT_SECONDS',
        '60',
        `Tiempo límite al enviar imágenes (registro y verificación facial). ${range(10, 600, ' s')}`,
      ],
      ['VITE_API_GET_RETRIES', '2', `Reintentos automáticos de lecturas (GET) ante errores transitorios. ${range(0, 5)}`],
      [
        'VITE_API_MAX_RETRY_AFTER_SECONDS',
        '10',
        `Espera máxima que se respeta de un Retry-After del servidor antes de reintentar. ${range(1, 60, ' s')}`,
      ],
      [
        'VITE_DEVICE_KEY_TIMEOUT_SECONDS',
        '5',
        'Espera máxima de la llave del dispositivo (WebCrypto e IndexedDB); tarde = se sigue sin llave y el servidor lo ' +
          `mide (nada se queda colgado). ${range(1, 30, ' s')}`,
      ],
    ],
  ],
  [
    'Tiempo real (WebSocket de validación en vivo)',
    [
      ['VITE_REALTIME_ENABLED', 'true', `Validación en vivo de datos únicos por WebSocket; false = solo respaldo HTTP. ${bool}`],
      [
        'VITE_REALTIME_TIMEOUT_SECONDS',
        '4',
        `Espera máxima por respuesta del canal antes de usar el respaldo HTTP. ${range(1, 30, ' s')}`,
      ],
      [
        'VITE_REALTIME_IDLE_SECONDS',
        '60',
        `El socket se cierra tras este tiempo sin validaciones (ahorra conexiones). ${range(10, 600, ' s')}`,
      ],
      ['VITE_AVAILABILITY_DEBOUNCE_MS', '350', `Pausa tras la última tecla antes de validar. ${range(100, 2000, ' ms')}`],
    ],
  ],
  [
    'Actualización periódica (con variación aleatoria; en pausa si la pestaña está oculta)',
    [
      ['VITE_POLL_PENDING_ENROLLMENTS_SECONDS', '45', `Registros faciales por revisar. ${range(10, 3600, ' s')}`],
      ['VITE_POLL_PENDING_ERRORS_SECONDS', '60', `Errores del sistema pendientes (ADMIN). ${range(10, 3600, ' s')}`],
      [
        'VITE_POLL_PENDING_SHIFT_REQUESTS_SECONDS',
        '60',
        `Solicitudes de cambio de turno pendientes. ${range(10, 3600, ' s')}`,
      ],
      [
        'VITE_POLL_PENDING_ABSENCE_REQUESTS_SECONDS',
        '60',
        `Solicitudes de ausencia pendientes. ${range(10, 3600, ' s')}`,
      ],
      ['VITE_POLL_PENDING_FRAUD_CASES_SECONDS', '60', `Casos de fraude por revisar (ADMIN). ${range(10, 3600, ' s')}`],
      [
        'VITE_POLL_PENDING_ATTENDANCE_REVIEWS_SECONDS',
        '60',
        `Registros de asistencia en revisión que la empresa confirma o rechaza. ${range(10, 3600, ' s')}`,
      ],
      [
        'VITE_POLL_VALIDATION_STATUS_SECONDS',
        '30',
        `Estado del registro facial en validación. ${range(10, 3600, ' s')}`,
      ],
      [
        'VITE_POLL_BUSINESS_SECONDS',
        '60',
        `Cobranza y Consumo (ADMIN): indicadores y listas mientras la pantalla se ve. ${range(15, 3600, ' s')}`,
      ],
      [
        'VITE_POLL_PERFORMANCE_SECONDS',
        '30',
        `Rendimiento (ADMIN): resumen, listas y alertas mientras la pantalla se ve. ${range(15, 3600, ' s')}`,
      ],
      [
        'VITE_POLL_SLOW_ALERTS_SECONDS',
        '30',
        'Alertas de peticiones lentas (ADMIN): contador del menú y aviso en vivo de una alerta nueva o reabierta ' +
          `(una sola consulta para los dos). ${range(10, 3600, ' s')}`,
      ],
      [
        'VITE_BILLING_PREVIEW_DEBOUNCE_MS',
        '450',
        `Pausa tras el último cambio del plan antes de pedir su vista previa del cobro. ${range(150, 3000, ' ms')}`,
      ],
    ],
  ],
  [
    'Reconocimiento facial',
    [
      [
        'VITE_FACE_ENROLLMENT_VALID_PHOTOS',
        '32',
        'Fotos VÁLIDAS del registro facial (solo cuentan las que pasan la revisión en vivo: rostro dentro de la guía, ' +
          'centrado, de frente y quieto, nítida y con luz; sin tope de intentos; el servidor las vuelve a validar y ' +
          `elige las mejores). ${range(1, 36)}`,
      ],
      [
        'VITE_FACE_ENROLLMENT_MIN_SHARPNESS',
        '12',
        `Nitidez mínima de una foto válida (varianza del Laplaciano sobre el rostro, 96 px). ${range(0, 500)}`,
      ],
      [
        'VITE_FACE_ENROLLMENT_PHOTO_PX',
        '640',
        `Lado mayor de cada foto del registro facial (≈ 0.05 MB cada una con 640). ${range(480, 1280, ' px')}`,
      ],
      [
        'VITE_FACE_ENROLLMENT_PHOTO_GAP_MS',
        '100',
        `Pausa mínima entre fotos del registro (cada una espera además un cuadro nuevo del video). ${range(40, 1000, ' ms')}`,
      ],
      [
        'VITE_VOICE_MAX_ANSWER_SECONDS',
        '12',
        `Verificación por voz: duración máxima de la grabación de una respuesta. ${range(2, 60, ' s')}`,
      ],
      [
        'VITE_VOICE_SILENCE_STOP_MS',
        '1200',
        `Silencio tras la voz que da la respuesta por terminada. ${range(300, 5000, ' ms')}`,
      ],
      ['VITE_VOICE_MIN_SPEECH_MS', '600', `Voz mínima antes de contar el silencio final. ${range(100, 5000, ' ms')}`],
      [
        'VITE_VOICE_VIDEO_BITRATE_KBPS',
        '600',
        `Tasa de bits del video grabado (con 600, ≈ 0.4 MB por respuesta de 5 s). ${range(100, 4000, ' kbps')}`,
      ],
      ['VITE_VOICE_LEVEL_FULL_SCALE', '0.25', `RMS (0-1) del micrófono que llena el medidor. ${range(0.05, 1)}`],
      ['VITE_FACE_VERIFICATION_FRAMES', '3', `Capturas frontales de cada verificación. ${range(1, 3)}`],
      ['VITE_FACE_FRAME_GAP_MS', '380', `Pausa entre capturas consecutivas. ${range(100, 2000, ' ms')}`],
      [
        'VITE_FACE_RESUME_AFTER_BLOCK_SECONDS',
        '3',
        `Pausa antes de reanudar la cámara tras rechazar una captura (accesorios, prueba de vida). ${range(1, 30, ' s')}`,
      ],
      [
        'VITE_FACE_CHALLENGE_TIMEOUT_SECONDS',
        '20',
        `Tiempo para cada movimiento del reto; el reto completo vence cuando dice el servidor. ${range(5, 85, ' s')}`,
      ],
      [
        'VITE_FACE_CHALLENGE_MARGIN_SECONDS',
        '5',
        `Margen antes de que venza el reto (lo que tarda en subir el envío). ${range(0, 30, ' s')}`,
      ],
      [
        'VITE_FACE_FLASH_HOLD_MS',
        '400',
        'Destello dictado por el servidor (apagado por omisión; lo dispara el reto): espera tras pintar cada color antes ' +
          `de capturar su cuadro (latencia de la cámara, bajo el límite de 3 destellos/s de WCAG 2.3.1). ${range(340, 2000, ' ms')}`,
      ],
      [
        'VITE_FACE_FLASH_LUMINANCE',
        '0.75',
        'Luminancia con que se pinta cada color del destello (1 = color puro; sobrio, sin saturar). El servidor compara ' +
          `la cromaticidad, no la luminancia. ${range(0.3, 1)}`,
      ],
      [
        'VITE_FACE_DETECTOR_TIMEOUT_SECONDS',
        '20',
        `Tiempo límite para cargar el detector de rostros (MediaPipe). ${range(5, 120, ' s')}`,
      ],
      ['VITE_FACE_DETECTION_MIN_SCORE', '0.6', `Confianza mínima del detector del navegador. ${range(0.1, 1)}`],
      [
        'VITE_FACE_DETECTION_INTERVAL_MS',
        '110',
        `Cada cuánto se analiza un cuadro de la cámara. ${range(50, 1000, ' ms')}`,
      ],
      [
        'VITE_FACE_FRONTAL_MAX_YAW',
        '0.1',
        'Validez de un cuadro de frente contra la guía dibujada (una foto se toma solo si es factible). Giro máximo ' +
          `(yaw_ratio; el servidor acepta 0.15). ${range(0.02, 0.3)}`,
      ],
      ['VITE_FACE_FRONTAL_MAX_ROLL_DEGREES', '12', `Inclinación lateral máxima en grados (el servidor acepta 15). ${range(2, 30)}`],
      [
        'VITE_FACE_FRONTAL_PITCH_MIN',
        '0.4',
        'Cabeceo de frente (nariz entre los ojos, 0, y la boca, 1): de 0.51 a 0.59 en un rostro real; fuera de esta ' +
          `banda se pide «Mira al frente» (el servidor acepta 0.20 a 0.85). ${range(0, 1)}`,
      ],
      ['VITE_FACE_FRONTAL_PITCH_MAX', '0.72', `Tope de la banda del cabeceo de frente. ${range(0, 1)}`],
      [
        'VITE_FACE_FRONTAL_PITCH_DRIFT',
        '0.06',
        'Cuánto puede subir o bajar la cabeza respecto al rostro en reposo durante las fotos (menos que el 0.08 con ' +
          `que el servidor da por hecho «mirar abajo»). ${range(0.01, 0.3)}`,
      ],
      ['VITE_FACE_GUIDE_MIN_FILL', '0.6', `Cuánto debe llenar el rostro la caja objetivo de la guía: menos, «Acércate». ${range(0.2, 1)}`],
      ['VITE_FACE_GUIDE_MAX_FILL', '1.15', `Más que esto, «Aléjate»: el rostro cabe dentro del contorno. ${range(1, 2)}`],
      [
        'VITE_FACE_CENTER_TOLERANCE',
        '0.15',
        `Cuánto puede alejarse el centro del rostro del centro de la guía (parte del tamaño de la caja objetivo). ${range(0.02, 0.5)}`,
      ],
      [
        'VITE_FACE_STEADY_MAX_SHIFT',
        '0.08',
        'Quietud suavizada (decisión del dueño, 2026-10-07): desplazamiento máximo respecto al promedio de la ventana, ' +
          `como parte del tamaño del rostro, antes de «Mantente quieto». ${range(0.01, 0.5)}`,
      ],
      [
        'VITE_FACE_STEADY_WINDOW',
        '4',
        `Cuántos cuadros promedia la ventana de quietud (un pico de ruido del detector apenas mueve el promedio). ${range(2, 12)}`,
      ],
      [
        'VITE_FACE_STEADY_GRACE_FRAMES',
        '2',
        `Cuántos cuadros seguidos por encima del umbral antes de marcar «Mantente quieto» (histéresis). ${range(1, 8)}`,
      ],
      [
        'VITE_FACE_ACCESSORY_CHECK_INTERVAL_MS',
        '2500',
        'Cada cuántos ms se valida un cuadro en el servidor para las insignias de accesorios (cubrebocas, lentes), de ' +
          `forma continua mientras hay rostro; throttleado para no spamear ni disparar la alerta de peticiones lentas. ${range(1000, 15000)}`,
      ],
      [
        'VITE_FACE_ACCESSORY_CHECK_PX',
        '480',
        `Lado del cuadro que se valida para las insignias de accesorios (chico: basta y pesa poco). ${range(240, 1280)} px.`,
      ],
      [
        'VITE_FACE_TURN_MARGIN',
        '0.04',
        'Giro extra que exige el navegador sobre el mínimo del servidor (MediaPipe y YuNet miden distinto: con ' +
          `margen, la captura enviada siempre supera la prueba de vida). ${range(0, 0.3)}`,
      ],
      ['VITE_FACE_PITCH_MARGIN', '0.02', `Lo mismo al mirar arriba o abajo. ${range(0, 0.3)}`],
      ['VITE_FACE_CLOSER_MARGIN', '0.05', `Lo mismo al acercarse (veces que crece el rostro). ${range(0, 0.5)}`],
      [
        'VITE_FACE_FRAME_RHYTHM_SAMPLES',
        '90',
        'Antifraude: intervalos entre cuadros del video que se miden durante el escaneo (ritmo de una cámara real ' +
          `frente a una virtual; solo números, viajan en la telemetría de la toma). ${range(10, 600)}`,
      ],
      [
        'VITE_FACE_BURST_FPS',
        '10',
        'Antifraude 2a (ráfaga de recortes del rostro): cuadros por segundo mientras aún no se sabe lo que pide el ' +
          `reto (después, los del servidor). ${range(4, 30)}`,
      ],
      [
        'VITE_FACE_BURST_STAGING_PX',
        '200',
        `Lado de cada recorte guardado en memoria (se reduce al del servidor al armar la hoja). ${range(96, 256, ' px')}`,
      ],
      [
        'VITE_FACE_BURST_STAGING_MARGIN',
        '2',
        'Cuántas veces el lado del rostro mide la zona que se recorta mientras llega el reto (al armar la hoja se ' +
          `ajusta al margen del servidor). ${range(1.2, 3)}`,
      ],
      [
        'VITE_FACE_BURST_MAX_FRAMES',
        '96',
        `Recortes que se guardan como máximo (el registro facial tiene un tramo quieto más largo: 36 fotos). ${range(10, 120)}`,
      ],
      [
        'VITE_FACE_BURST_HOLD_WAIT_MS',
        '1200',
        `Espera máxima para completar el tramo quieto antes del primer movimiento. ${range(0, 5000, ' ms')}`,
      ],
      [
        'VITE_MEDIAPIPE_WASM_URL',
        '/mediapipe/wasm',
        'WASM de MediaPipe (lo copia `npm install` a public/mediapipe; se sirve junto a la app).',
      ],
      ['VITE_FACE_MODEL_URL', '/mediapipe/blaze_face_short_range.tflite', 'Modelo de detección de rostros (local).'],
      [
        'VITE_FACE_MODEL_FALLBACK_URL',
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        'Respaldo remoto del modelo si el local no carga.',
      ],
      ['VITE_FACE_MODEL_FALLBACK_ENABLED', 'true', `Permitir el respaldo remoto del modelo. ${bool}`],
    ],
  ],
  [
    'Registro de asistencia (ubicación)',
    [
      [
        'VITE_LOCATION_SAMPLES',
        '3',
        'Lecturas de la ubicación que se toman para registrar (el servidor detecta una ubicación congelada o con la ' +
          `misma precisión siempre, típica de un simulador; registra la más precisa). ${range(1, 10)}`,
      ],
      [
        'VITE_LOCATION_SAMPLE_WINDOW_MS',
        '3000',
        `Tiempo máximo para tomar las lecturas de más (la primera ya basta para registrar). ${range(0, 15000, ' ms')}`,
      ],
      [
        'VITE_LOCATION_NETWORK_MAX_AGE_MS',
        '300000',
        '"Mi ubicación" del mapa: si la lectura precisa falla (computadora sin GPS), se acepta una lectura de la red ' +
          `Wi-Fi de hasta esta antigüedad (nunca en un registro). ${range(0, 3600000, ' ms')}`,
      ],
      [
        'VITE_LOCATION_NETWORK_TIMEOUT_MS',
        '10000',
        `Tiempo máximo de esa lectura de la red. ${range(1000, 30000, ' ms')}`,
      ],
    ],
  ],
  [
    'QR',
    [
      [
        'VITE_QR_PREFIX',
        'TCQR',
        'Prefijo común de los QR de la app: el lector descarta al instante cualquier otro QR (cuál sirve lo ' +
          'decide el backend).',
      ],
      ['VITE_QR_SCAN_INTERVAL_MS', '150', `Cada cuánto el lector analiza un cuadro de la cámara. ${range(50, 1000, ' ms')}`],
      [
        'VITE_QR_STATUS_POLL_SECONDS',
        '3',
        `Mi código QR: cada cuánto revisa si un validador ya lo usó (para mostrar otro). ${range(1, 10, ' s')}`,
      ],
    ],
  ],
  [
    'Punto de control (validador en tableta o teléfono)',
    [
      [
        'VITE_CHECKPOINT_RESULT_SECONDS',
        '6',
        `Segundos que el resultado queda en pantalla antes de esperar a la siguiente persona. ${range(2, 60, ' s')}`,
      ],
      [
        'VITE_CHECKPOINT_NONCE_MARGIN_SECONDS',
        '60',
        'Firma por petición: si el reto vence en menos de este margen, se pide uno nuevo antes de identificar. ' +
          range(10, 300, ' s'),
      ],
      [
        'VITE_CHECKPOINT_LOCATION_MAX_AGE_SECONDS',
        '30',
        `Ubicación en cada identificación: antigüedad máxima de la lectura que se envía. ${range(5, 300, ' s')}`,
      ],
      [
        'VITE_CHECKPOINT_LOCATION_WAIT_SECONDS',
        '8',
        'Sin una lectura reciente, espera máxima por la siguiente (después se identifica sin ella: decide el ' +
          `servidor). ${range(1, 30, ' s')}`,
      ],
    ],
  ],
  [
    'Kiosco del sitio (pantalla pública /kiosk con el código del sitio)',
    [
      [
        'VITE_KIOSK_RETRY_MAX_SECONDS',
        '60',
        `Sin conexión, los reintentos esperan cada vez el doble, hasta este tope. ${range(5, 600, ' s')}`,
      ],
      [
        'VITE_KIOSK_DISABLED_RETRY_SECONDS',
        '120',
        `El sitio desactivó su código: cada cuánto se vuelve a preguntar. ${range(15, 3600, ' s')}`,
      ],
    ],
  ],
  [
    'Google Maps (domicilio y ubicación de validadores)',
    [
      [
        'VITE_GOOGLE_MAPS_API_KEY',
        '',
        'Clave de navegador (NO va en el repositorio): restríngela en Google Cloud por dominio (HTTP referrer) y a ' +
          'las APIs Maps JavaScript, Places (New) y Geocoding. Vacía = domicilio solo a mano, sin mapa.',
      ],
      ['VITE_GOOGLE_PLACES', 'false', `Búsqueda de lugares y direcciones (Places API (New) habilitada). ${bool}`],
      [
        'VITE_GOOGLE_GEOCODING',
        'false',
        `Llenar el domicilio al marcar un punto y ubicar la dirección escrita (Geocoding API habilitada). ${bool}`,
      ],
      [
        'VITE_GOOGLE_GEOLOCATION',
        'false',
        `"Mi ubicación": si el navegador no la da, se estima con Geolocation API de Google (menos precisa). ${bool}`,
      ],
    ],
  ],
  [
    'Analítica de uso (Firebase / Google Analytics 4) con candados de privacidad',
    [
      [
        'VITE_ANALYTICS_ENABLED',
        '',
        'Solo pantallas como plantilla y eventos sin datos de personas ni empresas. true | false; vacío = solo en ' +
          'producción (el build de Docker).',
      ],
      ['VITE_FIREBASE_API_KEY', '', 'Configuración web de Firebase (consola de Firebase); vacía = sin analítica.'],
      ['VITE_FIREBASE_AUTH_DOMAIN', '', ''],
      ['VITE_FIREBASE_PROJECT_ID', '', ''],
      ['VITE_FIREBASE_STORAGE_BUCKET', '', ''],
      ['VITE_FIREBASE_MESSAGING_SENDER_ID', '', ''],
      ['VITE_FIREBASE_APP_ID', '', ''],
      ['VITE_FIREBASE_MEASUREMENT_ID', '', ''],
    ],
  ],
  [
    'Rendimiento visto desde el navegador (Web Vitals, tareas largas y latencia de la API; solo al backend propio)',
    [
      [
        'VITE_PERF_ENABLED',
        'true',
        'Medir y enviar al backend (POST /api/telemetry/web) solo plantillas de pantallas y rutas con sus tiempos, ' +
          `sin ids, query ni datos de personas. ${bool}`,
      ],
      [
        'VITE_PERF_SAMPLE_RATE',
        '1',
        `Parte de las cargas de la página que miden (0 = ninguna, 1 = todas; se decide una vez por carga). ${range(0, 1)}`,
      ],
      [
        'VITE_PERF_FLUSH_SECONDS',
        '30',
        `Cada cuánto se envía lo medido (también al ocultarse o cerrarse la página). ${range(5, 300, ' s')}`,
      ],
      [
        'VITE_PERF_MAX_SAMPLES',
        '300',
        `Tope de muestras en memoria entre envíos; lo que sobra se descarta (el backend acepta hasta 500). ${range(10, 500)}`,
      ],
      [
        'VITE_PERF_TIMEOUT_SECONDS',
        '5',
        `Tiempo límite de cada envío; sin reintentos (un lote que no llega se descarta). ${range(1, 30, ' s')}`,
      ],
    ],
  ],
  [
    'Formularios y listados',
    [
      ['VITE_MIN_EMPLOYEE_AGE', '16', `Edad mínima de un empleado. ${range(14, 100, ' años')}`],
      [
        'VITE_AVATAR_MAX_MB',
        '5',
        'Foto de perfil: tamaño máximo antes de subirla (solo ayuda; el backend valida con AVATAR_MAX_MB, que debe ' +
          `ser el mismo). ${range(1, 20, ' MB')}`,
      ],
      [
        'VITE_AVATAR_MIN_SIDE_PX',
        '128',
        `Foto de perfil: lado mínimo del recorte (igual a AVATAR_MIN_SIDE_PX del backend). ${range(64, 512, ' px')}`,
      ],
      ['VITE_AVATAR_MAX_ZOOM', '5', `Foto de perfil: cuánto se puede acercar al recortarla. ${range(1, 10, ' veces')}`],
      [
        'VITE_AVATAR_CACHE_ENTRIES',
        '200',
        `Fotos de perfil que la página conserva en memoria sin mostrarse (las visibles nunca se descartan). ${range(20, 2000)}`,
      ],
      [
        'VITE_COMPANY_DOCUMENT_MAX_MB',
        '20',
        'Documentos de una empresa: tamaño máximo antes de subirlo (solo ayuda; el backend valida con ' +
          `COMPANY_DOCUMENT_MAX_MB, que debe ser el mismo). ${range(1, 25, ' MB')}`,
      ],
      [
        'VITE_EMPLOYEE_DOCUMENT_MAX_MB',
        '15',
        'Documentos de identidad del empleado (onboarding con OCR): tamaño máximo antes de subirlo (solo ayuda; el ' +
          `backend valida con EMPLOYEE_DOCUMENT_MAX_MB, que debe ser el mismo). ${range(1, 25, ' MB')}`,
      ],
      [
        'VITE_PAGE_SIZES',
        '10,20,30,40,50',
        'Opciones de "por página" de todos los listados, separadas por comas (enteros de 1 a 50: el backend acepta ' +
          'hasta 50).',
      ],
      ['VITE_PAGE_SIZE', '10', 'Elementos por página al abrir un listado (una de las opciones de VITE_PAGE_SIZES).'],
    ],
  ],
  [
    'Servidor de desarrollo (solo `npm run dev`, vite.config.ts)',
    [
      [
        'VITE_DEV_HTTPS',
        'false',
        `HTTPS en el servidor de desarrollo (la cámara de un teléfono de la red local lo exige). ${bool}`,
      ],
      [
        'VITE_PROXY_TARGET',
        'http://localhost:8000',
        'Backend al que el servidor de desarrollo reenvía /api (con VITE_API_URL=/api); http://localhost:8080 = el ' +
          'gateway de docker compose.',
      ],
      [
        'VITE_ALLOWED_HOSTS',
        '',
        'Hosts extra permitidos, separados por comas (los dominios de ngrok ya lo están). Vacío = ninguno.',
      ],
    ],
  ],
];

const HEADER = `# =====================================================================================
#  Employee Time Clock Web — ÚNICO archivo de configuración del frontend
#  Se lee en src/utils/config.ts (valores validados con límites) y en vite.config.ts.
#  IMPORTANTE: las variables VITE_* se incrustan en el bundle (son públicas): nunca pongas secretos.
#  Tiene TODAS las variables con su valor (el del código si nadie lo cambió). Vacío = valor por defecto.
#  Instalación nueva: node scripts/generate-env.mjs > .env (luego las claves de Google Maps y Firebase).
#  Una variable nueva va a src/utils/config.ts (o vite.config.ts), a scripts/generate-env.mjs Y aquí en el
#  mismo cambio: src/utils/envFile.test.ts lo exige.
# =====================================================================================`;

/** Divide un comentario en renglones de a lo más ~110 caracteres. */
function wrap(text, width = 108) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return line ? [...lines, line] : lines;
}

function render() {
  const out = [HEADER];
  for (const [title, variables] of SECTIONS) {
    out.push('', `# ---------- ${title} ----------`);
    for (const [name, value, note] of variables) {
      out.push(...wrap(note).map((line) => `# ${line}`), `${name}=${value}`);
    }
  }
  return `${out.join('\n')}\n`;
}

process.stdout.write(render());
