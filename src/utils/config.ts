import { envBoolean, envNumber, envNumberList, envString } from './env';

/**
 * Configuración centralizada del frontend: ÚNICA fuente de valores configurables.
 * Se definen en `frontend/.env` (único archivo de configuración del frontend; solo variables con
 * valor) y se validan aquí con valores por defecto seguros. Ningún otro módulo lee `import.meta.env`.
 */
const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const base = import.meta.env.BASE_URL;
const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const seconds = (key: string, fallback: number, min: number, max: number) => envNumber(env, key, fallback, min, max) * 1000;

const pageSizes = envNumberList(env, 'VITE_PAGE_SIZES', [10, 20, 30, 40, 50], 1, 50);
const wantedPageSize = envNumber(env, 'VITE_PAGE_SIZE', 10, 1, 50);
const defaultPageSize = pageSizes.includes(wantedPageSize) ? wantedPageSize : pageSizes[0];

export const config = {
  appName: envString(env, 'VITE_APP_NAME', 'Employee Time Clock'),
  appTagline: envString(env, 'VITE_APP_TAGLINE', 'Control de asistencia y jornada laboral.'),
  /** Compilación en ejecución y dónde consultar la publicada (detección de versiones nuevas). */
  buildId: __APP_BUILD_ID__,
  versionUrl: `${base}version.json`,
  versionCheckMs: seconds('VITE_VERSION_CHECK_SECONDS', 60, 15, 3600),

  // --- API ---
  apiUrl: stripTrailingSlash(envString(env, 'VITE_API_URL', '/api')),
  apiTimeoutMs: seconds('VITE_API_TIMEOUT_SECONDS', 30, 5, 300),
  /** Envío de imágenes (registro y verificación facial). */
  apiUploadTimeoutMs: seconds('VITE_API_UPLOAD_TIMEOUT_SECONDS', 60, 10, 600),
  /** Reintentos automáticos de lecturas (GET) ante errores transitorios. */
  apiGetRetries: envNumber(env, 'VITE_API_GET_RETRIES', 2, 0, 5),
  apiMaxRetryAfterMs: seconds('VITE_API_MAX_RETRY_AFTER_SECONDS', 10, 1, 60),

  // --- Tiempo real (WebSocket de validación) ---
  realtimeEnabled: envBoolean(env, 'VITE_REALTIME_ENABLED', true),
  /** Espera máxima por respuesta del canal antes de usar el respaldo HTTP. */
  realtimeTimeoutMs: seconds('VITE_REALTIME_TIMEOUT_SECONDS', 4, 1, 30),
  /** El socket se cierra tras este tiempo sin validaciones (ahorra conexiones en el servidor). */
  realtimeIdleMs: seconds('VITE_REALTIME_IDLE_SECONDS', 60, 10, 600),
  /** Pausa tras la última tecla antes de validar. */
  availabilityDebounceMs: envNumber(env, 'VITE_AVAILABILITY_DEBOUNCE_MS', 350, 100, 2000),

  // --- Actualización periódica (con jitter, pausada si la pestaña está oculta) ---
  pendingEnrollmentsPollMs: seconds('VITE_POLL_PENDING_ENROLLMENTS_SECONDS', 45, 10, 3600),
  pendingErrorsPollMs: seconds('VITE_POLL_PENDING_ERRORS_SECONDS', 60, 10, 3600),
  pendingShiftRequestsPollMs: seconds('VITE_POLL_PENDING_SHIFT_REQUESTS_SECONDS', 60, 10, 3600),
  pendingAbsenceRequestsPollMs: seconds('VITE_POLL_PENDING_ABSENCE_REQUESTS_SECONDS', 60, 10, 3600),
  validationStatusPollMs: seconds('VITE_POLL_VALIDATION_STATUS_SECONDS', 30, 10, 3600),

  // --- Reconocimiento facial ---
  enrollmentFrames: envNumber(env, 'VITE_FACE_ENROLLMENT_FRAMES', 5, 1, 5),
  verificationFrames: envNumber(env, 'VITE_FACE_VERIFICATION_FRAMES', 3, 1, 3),
  faceFrameGapMs: envNumber(env, 'VITE_FACE_FRAME_GAP_MS', 380, 100, 2000),
  faceResumeAfterBlockMs: seconds('VITE_FACE_RESUME_AFTER_BLOCK_SECONDS', 3, 1, 30),
  /** Tiempo para cada movimiento del reto; el reto completo, además, vence cuando dice el servidor. */
  faceChallengeTimeoutMs: seconds('VITE_FACE_CHALLENGE_TIMEOUT_SECONDS', 20, 5, 85),
  /** Margen antes de que venza el reto (`expires_in`): lo que tarda en subir el envío. */
  faceChallengeMarginMs: seconds('VITE_FACE_CHALLENGE_MARGIN_SECONDS', 5, 0, 30),
  /**
   * Destello de colores: espera tras pintar cada color antes de capturar. Cubre la latencia de la
   * cámara (el cuadro debe mostrar ya el color) y es menor a lo que tarda el balance de blancos
   * automático en compensarlo (≈ 0.5–1 s en iPhone). Cada color queda unos 0.4 s: ≈ 2.3 cambios por
   * segundo, con margen bajo el límite de 3 destellos por segundo (WCAG 2.3.1, fotosensibilidad); por
   * eso el mínimo configurable es 340 ms.
   */
  faceFlashSettleMs: envNumber(env, 'VITE_FACE_FLASH_SETTLE_MS', 400, 340, 1000),
  faceDetectorTimeoutMs: seconds('VITE_FACE_DETECTOR_TIMEOUT_SECONDS', 20, 5, 120),
  faceDetectionMinScore: envNumber(env, 'VITE_FACE_DETECTION_MIN_SCORE', 0.6, 0.1, 1),
  faceDetectionIntervalMs: envNumber(env, 'VITE_FACE_DETECTION_INTERVAL_MS', 110, 50, 1000),
  /** Giro extra que exige el navegador sobre el mínimo del servidor: MediaPipe (cliente) y YuNet
   *  (servidor) miden distinto; con margen, la captura enviada siempre supera la prueba de vida. */
  faceTurnMargin: envNumber(env, 'VITE_FACE_TURN_MARGIN', 0.04, 0, 0.3),
  /** Lo mismo al mirar arriba o abajo (cambio de la nariz entre ojos y boca)... */
  facePitchMargin: envNumber(env, 'VITE_FACE_PITCH_MARGIN', 0.02, 0, 0.3),
  /** ...y al acercarse (veces que crece el rostro, sobre el mínimo del servidor). */
  faceCloserMargin: envNumber(env, 'VITE_FACE_CLOSER_MARGIN', 0.05, 0, 0.5),
  mediapipeWasmUrl: envString(env, 'VITE_MEDIAPIPE_WASM_URL', `${base}mediapipe/wasm`),
  faceModelUrl: envString(env, 'VITE_FACE_MODEL_URL', `${base}mediapipe/blaze_face_short_range.tflite`),
  faceModelFallbackUrl: envString(
    env,
    'VITE_FACE_MODEL_FALLBACK_URL',
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  ),
  /** Permitir el respaldo remoto del modelo si el local no carga. */
  faceModelFallbackEnabled: envBoolean(env, 'VITE_FACE_MODEL_FALLBACK_ENABLED', true),

  // --- QR ---
  /**
   * Prefijo común de los QR de la app: el lector descarta al instante cualquier otro QR. Cuál sirve
   * (el dinámico "TCQR2:"; el impreso anterior "TCQR1:" ya no) lo decide el backend.
   */
  qrPrefix: envString(env, 'VITE_QR_PREFIX', 'TCQR'),
  qrScanIntervalMs: envNumber(env, 'VITE_QR_SCAN_INTERVAL_MS', 150, 50, 1000),
  /** Cada cuántos segundos "Mi código QR" consulta si un validador ya lo usó (para mostrar otro). */
  qrStatusPollSeconds: envNumber(env, 'VITE_QR_STATUS_POLL_SECONDS', 3, 1, 10),

  // --- Punto de control (validador en tableta o teléfono) ---
  /** Segundos que el resultado queda en pantalla antes de volver a esperar a la siguiente persona. */
  checkpointResultSeconds: envNumber(env, 'VITE_CHECKPOINT_RESULT_SECONDS', 6, 2, 60),

  // --- Google Maps (domicilio y ubicación de los validadores) ---
  maps: {
    /** Clave de navegador (restringida por dominio en Google Cloud). Vacía = domicilio solo a mano, sin mapa. */
    apiKey: envString(env, 'VITE_GOOGLE_MAPS_API_KEY', ''),
    /** Búsqueda de lugares y direcciones (Places API (New)). */
    places: envBoolean(env, 'VITE_GOOGLE_PLACES', false),
    /** Llenar el domicilio al marcar un punto y ubicar en el mapa la dirección escrita (Geocoding API). */
    geocoding: envBoolean(env, 'VITE_GOOGLE_GEOCODING', false),
    /** "Mi ubicación": si el navegador no la da, se estima con Geolocation API de Google (menos precisa). */
    geolocation: envBoolean(env, 'VITE_GOOGLE_GEOLOCATION', false),
  },

  // --- Formularios y listados ---
  minEmployeeAge: envNumber(env, 'VITE_MIN_EMPLOYEE_AGE', 16, 14, 100),
  /** Opciones de "por página" de todos los listados (el backend acepta hasta 50). */
  pageSizes,
  /** Elementos por página al abrir cualquier listado (una de las opciones). */
  pageSize: defaultPageSize,
} as const;

export type AppConfig = typeof config;
