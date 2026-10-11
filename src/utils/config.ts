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
  appName: envString(env, 'VITE_APP_NAME', 'Identity Verification Platform'),
  /**
   * Lema del HTML inicial (`index.html`, antes de que cargue la app). La interfaz usa el del idioma activo
   * (`app.tagline` en los diccionarios de los siete idiomas), que también reemplaza el título de la pestaña.
   */
  appTagline: envString(env, 'VITE_APP_TAGLINE', 'Plataforma de verificación de identidad digital y biométrica'),
  /** Compilación en ejecución y dónde consultar la publicada (detección de versiones nuevas). */
  buildId: __APP_BUILD_ID__,
  versionUrl: `${base}version.json`,
  versionCheckMs: seconds('VITE_VERSION_CHECK_SECONDS', 60, 15, 3600),

  // --- API ---
  apiUrl: stripTrailingSlash(envString(env, 'VITE_API_URL', '/api')),
  apiTimeoutMs: seconds('VITE_API_TIMEOUT_SECONDS', 30, 5, 300),
  /** Envío de imágenes (registro y verificación facial). */
  apiUploadTimeoutMs: seconds('VITE_API_UPLOAD_TIMEOUT_SECONDS', 60, 10, 600),
  /**
   * Lecturas pesadas que el servidor arma de una vez: la exportación de los datos de una persona (RGPD arts. 15 y
   * 20) y la de la bitácora de auditoría o del informe de accesos para el auditor. Recorren varias tablas acotadas
   * y tardan más que una pantalla, así que no comparten el tiempo límite de una lectura normal.
   */
  exportTimeoutMs: seconds('VITE_EXPORT_TIMEOUT_SECONDS', 90, 10, 600),
  /** Reintentos automáticos de lecturas (GET) ante errores transitorios. */
  apiGetRetries: envNumber(env, 'VITE_API_GET_RETRIES', 2, 0, 5),
  apiMaxRetryAfterMs: seconds('VITE_API_MAX_RETRY_AFTER_SECONDS', 10, 1, 60),

  /**
   * Espera máxima de la llave del dispositivo (WebCrypto e IndexedDB: firmar o leerla). Un almacenamiento que no
   * responde (modo privado estricto, un navegador integrado) no deja colgado un registro ni un inicio de sesión: se
   * sigue sin llave y el servidor lo mide.
   */
  deviceKeyTimeoutMs: seconds('VITE_DEVICE_KEY_TIMEOUT_SECONDS', 5, 1, 30),

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
  /** Casos de fraude por revisar (contador del menú del ADMIN). */
  pendingFraudCasesPollMs: seconds('VITE_POLL_PENDING_FRAUD_CASES_SECONDS', 60, 10, 3600),
  /** Registros de asistencia "en revisión" que la empresa confirma o rechaza (contador del menú). */
  pendingAttendanceReviewsPollMs: seconds('VITE_POLL_PENDING_ATTENDANCE_REVIEWS_SECONDS', 60, 10, 3600),
  validationStatusPollMs: seconds('VITE_POLL_VALIDATION_STATUS_SECONDS', 30, 10, 3600),
  /** Cobranza y consumo (ADMIN): indicadores y listas se actualizan solos mientras la pantalla se ve. */
  businessRefreshMs: seconds('VITE_POLL_BUSINESS_SECONDS', 60, 15, 3600),
  /** Rendimiento (ADMIN): resumen, listas y alertas se actualizan solos mientras la pantalla se ve. */
  performanceRefreshMs: seconds('VITE_POLL_PERFORMANCE_SECONDS', 30, 15, 3600),
  /**
   * Alertas de peticiones lentas (ADMIN, regla 18): UNA consulta del resumen alimenta el contador del menú y
   * el aviso en vivo de una alerta nueva o reabierta.
   */
  slowAlertsPollMs: seconds('VITE_POLL_SLOW_ALERTS_SECONDS', 30, 10, 3600),
  /** Pausa tras el último cambio del plan antes de pedir su vista previa del cobro (la calcula el backend). */
  billingPreviewDebounceMs: envNumber(env, 'VITE_BILLING_PREVIEW_DEBOUNCE_MS', 450, 150, 3000),

  // --- Reconocimiento facial ---
  /**
   * Registro facial (decisión del dueño, 2026-10-06 y 2026-10-07: 32 fotos VÁLIDAS, no 32 intentos, y nunca se repite
   * el proceso): fotos completas que se toman mientras la persona mira a la cámara, contando SOLO las que pasan la
   * revisión en vivo (rostro dentro de la guía, centrado, de frente y quieto, nítida —varianza del Laplaciano sobre el
   * rostro ≥ `enrollmentMinSharpness`— y con luz; «Capturas válidas: 24/32»; sin tope de cuadros: el escaneo espera a
   * la persona), el lado mayor de cada una (px) y la pausa mínima entre una y otra (cada foto espera además un cuadro
   * NUEVO del video). El servidor las vuelve a validar todas, elige las mejores como referencia y descarta las demás
   * (acepta hasta `FACE_ENROLL_MAX_PHOTOS`). Con 640 px cada foto pesa ≈ 0.05 MB: las 32, ≈ 1.6 MB.
   */
  enrollmentValidPhotos: envNumber(env, 'VITE_FACE_ENROLLMENT_VALID_PHOTOS', 32, 1, 36),
  enrollmentMinSharpness: envNumber(env, 'VITE_FACE_ENROLLMENT_MIN_SHARPNESS', 12, 0, 500),
  enrollmentPhotoPx: envNumber(env, 'VITE_FACE_ENROLLMENT_PHOTO_PX', 640, 480, 1280),
  enrollmentPhotoGapMs: envNumber(env, 'VITE_FACE_ENROLLMENT_PHOTO_GAP_MS', 100, 40, 1000),
  /**
   * Verificación por voz y video del registro (decisión del dueño, 2026-10-06): lo más que dura la grabación de una
   * respuesta (s; el servidor rechaza más de `SPEECH_MAX_ANSWER_SECONDS`), el silencio tras la voz que la da por
   * terminada (ms), la voz mínima para empezar a contar ese silencio (ms), la tasa de bits del video grabado (kbps; con
   * 600 un clip de 5 s pesa ≈ 0.4 MB) y la sensibilidad del medidor del micrófono (RMS 0-1 que llena el medidor).
   */
  voiceMaxAnswerSeconds: envNumber(env, 'VITE_VOICE_MAX_ANSWER_SECONDS', 12, 2, 60),
  voiceSilenceStopMs: envNumber(env, 'VITE_VOICE_SILENCE_STOP_MS', 1200, 300, 5000),
  voiceMinSpeechMs: envNumber(env, 'VITE_VOICE_MIN_SPEECH_MS', 600, 100, 5000),
  voiceVideoBitrateKbps: envNumber(env, 'VITE_VOICE_VIDEO_BITRATE_KBPS', 600, 100, 4000),
  voiceLevelFullScale: envNumber(env, 'VITE_VOICE_LEVEL_FULL_SCALE', 0.25, 0.05, 1),
  verificationFrames: envNumber(env, 'VITE_FACE_VERIFICATION_FRAMES', 3, 1, 3),
  faceFrameGapMs: envNumber(env, 'VITE_FACE_FRAME_GAP_MS', 380, 100, 2000),
  faceResumeAfterBlockMs: seconds('VITE_FACE_RESUME_AFTER_BLOCK_SECONDS', 3, 1, 30),
  /** Tiempo para cada movimiento del reto; el reto completo, además, vence cuando dice el servidor. */
  faceChallengeTimeoutMs: seconds('VITE_FACE_CHALLENGE_TIMEOUT_SECONDS', 20, 5, 85),
  /** Margen antes de que venza el reto (`expires_in`): lo que tarda en subir el envío. */
  faceChallengeMarginMs: seconds('VITE_FACE_CHALLENGE_MARGIN_SECONDS', 5, 0, 30),
  /**
   * Destello dictado por el servidor (restaurado el 2026-10-08 como interruptor del ADMIN, apagado por omisión; lo
   * dispara el RETO —`flash_pace` o `flash`—, nunca una bandera de la app): espera tras pintar cada color antes de
   * capturar su cuadro. Cubre la latencia de la cámara (el cuadro debe mostrar ya el color) y es menor a lo que tarda el
   * balance de blancos automático en compensarlo (≈ 0.5–1 s en iPhone). Cada color queda unos 0.4 s: ≈ 2.3 cambios por
   * segundo, con margen bajo el límite de 3 destellos por segundo (WCAG 2.3.1, fotosensibilidad); por eso el mínimo
   * configurable es 340 ms.
   */
  faceFlashHoldMs: envNumber(env, 'VITE_FACE_FLASH_HOLD_MS', 400, 340, 2000),
  /**
   * Luminancia con que la pantalla pinta cada color del destello (1 = el color puro; decisión del dueño, 2026-10-06:
   * un aspecto sobrio, sin colores saturados a toda pantalla). El servidor compara la CROMATICIDAD (proporción de rojo,
   * verde y azul), que no cambia con la luminancia; la magnitud medida baja en la misma proporción. Bajarla más debilita
   * la medición.
   */
  faceFlashLuminance: envNumber(env, 'VITE_FACE_FLASH_LUMINANCE', 0.75, 0.3, 1),
  faceDetectorTimeoutMs: seconds('VITE_FACE_DETECTOR_TIMEOUT_SECONDS', 20, 5, 120),
  faceDetectionMinScore: envNumber(env, 'VITE_FACE_DETECTION_MIN_SCORE', 0.6, 0.1, 1),
  faceDetectionIntervalMs: envNumber(env, 'VITE_FACE_DETECTION_INTERVAL_MS', 110, 50, 1000),
  /**
   * Validez de un cuadro de FRENTE (decisión del dueño, 2026-10-07: una foto se toma solo si es factible; mirar hacia
   * abajo, salirse de la guía o moverse NO es válido), medida contra la guía que se dibuja (`faceGuideShape.ts`).
   * Pose: giro (`yaw_ratio`), inclinación (grados) y cabeceo (`pitch_ratio`: la nariz entre los ojos, 0, y la boca, 1)
   * dentro de un margen MÁS estricto que el del servidor (`FACE_MAX_YAW_RATIO` 0.15, `FACE_MAX_ROLL_DEGREES` 15 y el
   * cabeceo 0.20-0.85 de `pipeline.py`): MediaPipe y YuNet miden distinto y lo que la app acepta debe pasar allá.
   * Calibrado con un rostro real y el detector de la app (harness): el cabeceo de frente mide 0.51-0.59 con ±0.03 de
   * ruido entre cuadros, y la inclinación natural de una foto de frente llega a 9° (los puntos de los ojos son gruesos).
   * `faceFrontalPitchDrift`: cuánto puede subir o bajar la cabeza respecto al rostro en reposo mientras se toman las
   * fotos (menos que lo que el servidor da por «mirar abajo», `FACE_LIVENESS_MIN_PITCH_DELTA` 0.08).
   * Encuadre: cuánto llena el rostro detectado la caja objetivo de la guía (`faceGuideMinFill`, «Acércate»;
   * `faceGuideMaxFill`, «Aléjate»: el rostro cabe dentro del contorno) y cuánto puede alejarse su centro del de la
   * guía (`faceCenterTolerance`, parte del tamaño de la caja). Quietud (decisión del dueño, 2026-10-07: el rechazo por
   * «movimiento no solicitado» saltaba de más en el iPhone): el desplazamiento se mide SUAVIZADO contra el promedio de
   * una ventana corta (`faceSteadyWindow`) y solo se marca «Mantente quieto» si supera `faceSteadyMaxShift` (parte del
   * tamaño del rostro) durante `faceSteadyGraceFrames` cuadros SEGUIDOS (un pico de ruido del detector no rechaza). Afloja
   * solo la quietud: la validez de posición y de pose NO se relaja.
   */
  faceFrontalMaxYaw: envNumber(env, 'VITE_FACE_FRONTAL_MAX_YAW', 0.1, 0.02, 0.3),
  faceFrontalMaxRollDegrees: envNumber(env, 'VITE_FACE_FRONTAL_MAX_ROLL_DEGREES', 12, 2, 30),
  faceFrontalPitchMin: envNumber(env, 'VITE_FACE_FRONTAL_PITCH_MIN', 0.4, 0, 1),
  faceFrontalPitchMax: envNumber(env, 'VITE_FACE_FRONTAL_PITCH_MAX', 0.72, 0, 1),
  faceFrontalPitchDrift: envNumber(env, 'VITE_FACE_FRONTAL_PITCH_DRIFT', 0.06, 0.01, 0.3),
  faceGuideMinFill: envNumber(env, 'VITE_FACE_GUIDE_MIN_FILL', 0.6, 0.2, 1),
  faceGuideMaxFill: envNumber(env, 'VITE_FACE_GUIDE_MAX_FILL', 1.15, 1, 2),
  faceCenterTolerance: envNumber(env, 'VITE_FACE_CENTER_TOLERANCE', 0.15, 0.02, 0.5),
  faceSteadyMaxShift: envNumber(env, 'VITE_FACE_STEADY_MAX_SHIFT', 0.08, 0.01, 0.5),
  faceSteadyWindow: envNumber(env, 'VITE_FACE_STEADY_WINDOW', 4, 2, 12),
  faceSteadyGraceFrames: envNumber(env, 'VITE_FACE_STEADY_GRACE_FRAMES', 2, 1, 8),
  /**
   * Vigilancia CONTINUA de accesorios (decisión del dueño, 2026-10-07: la insignia de cubrebocas/lentes debe aparecer en
   * CUALQUIER momento del flujo): mientras hay un rostro a la vista, cada `faceAccessoryCheckIntervalMs` se valida un
   * cuadro en el servidor (`/face/check`) y se actualizan las insignias. Throttleada y sin solaparse para no spamear ni
   * disparar la alerta de peticiones lentas (la ruta facial alerta desde 2.5 s); el cuadro se toma a `faceAccessoryCheckPx`
   * de lado (chico: basta para los accesorios y pesa poco). Ese cuadro solo va a `/face/check`, nunca a la toma enviada.
   */
  faceAccessoryCheckIntervalMs: envNumber(env, 'VITE_FACE_ACCESSORY_CHECK_INTERVAL_MS', 2500, 1000, 15000),
  faceAccessoryCheckPx: envNumber(env, 'VITE_FACE_ACCESSORY_CHECK_PX', 480, 240, 1280),
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
  /**
   * Antifraude (telemetría de la toma): intervalos entre cuadros del video que se miden durante el escaneo
   * (`requestVideoFrameCallback`): una cámara real varía; una virtual o un video, no. Solo números.
   */
  faceFrameRhythmSamples: envNumber(env, 'VITE_FACE_FRAME_RHYTHM_SAMPLES', 90, 10, 600),
  /**
   * Antifraude 2a (ráfaga de recortes del rostro): cuadros por segundo con que se recorta el rostro mientras aún no
   * se sabe lo que pide el reto (después, los del servidor), lado de cada recorte guardado en memoria y cuánto más
   * grande que el rostro es la zona (al armar la hoja se reducen al lado y al margen del servidor), cuántos se guardan
   * como máximo y cuánto se espera, como mucho, a completar el tramo quieto antes del destello.
   */
  faceBurstFps: envNumber(env, 'VITE_FACE_BURST_FPS', 10, 4, 30),
  faceBurstStagingPx: envNumber(env, 'VITE_FACE_BURST_STAGING_PX', 200, 96, 256),
  faceBurstStagingMargin: envNumber(env, 'VITE_FACE_BURST_STAGING_MARGIN', 2, 1.2, 3),
  faceBurstMaxFrames: envNumber(env, 'VITE_FACE_BURST_MAX_FRAMES', 96, 10, 120),
  faceBurstHoldWaitMs: envNumber(env, 'VITE_FACE_BURST_HOLD_WAIT_MS', 1200, 0, 5000),

  // --- Escáner de documento (foto del documento de identidad del empleado, con OCR en el servidor) ---
  /**
   * Captura con cámara del documento de identidad (`DocumentScanner`, «Mis documentos» → «Subir documento»): un escáner
   * en vivo que mide CADA cuadro dentro de la guía (sin volver a dibujar en React por cuadro, como el escaneo facial) y
   * toma la foto SOLA cuando el documento llena la guía, está enfocado, con luz, sin reflejos, derecho y quieto; también
   * hay un obturador manual «Tomar foto». Igual que la calidad del cuadro facial, son límites de captura del DISPOSITIVO
   * (globales, no por empresa): el servidor vuelve a revisar la imagen y la lee con OCR. Qué se mide: nitidez (varianza
   * del Laplaciano sobre la región en gris), brillo medio (0-255), reflejos (fracción de píxeles casi saturados), llenado
   * (densidad del contenido del documento dentro de la guía), cobertura (cuánto del lado de la guía ocupa la caja de
   * contenido) y centrado. Para no tomar fotos «a lo pendejo», la captura automática exige una señal CLARAMENTE de
   * documento (llenado + cobertura), no solo nitidez y luz. La guía es solo visual: la foto es el cuadro completo (sin
   * recorte; el recorte y el enderezado automáticos quedan para una v2).
   */
  docScanMinSharpness: envNumber(env, 'VITE_DOC_SCAN_MIN_SHARPNESS', 12, 0, 500),
  docScanMinBrightness: envNumber(env, 'VITE_DOC_SCAN_MIN_BRIGHTNESS', 50, 0, 255),
  docScanMaxBrightness: envNumber(env, 'VITE_DOC_SCAN_MAX_BRIGHTNESS', 235, 0, 255),
  /** Luminancia (0-255) a partir de la cual un píxel es «reflejo» y la fracción máxima de ellos antes de avisar. */
  docScanGlareLevel: envNumber(env, 'VITE_DOC_SCAN_GLARE_LEVEL', 245, 200, 255),
  docScanGlareMax: envNumber(env, 'VITE_DOC_SCAN_GLARE_MAX', 0.06, 0, 1),
  /** Cuánto debe llenar el contenido del documento la guía (0-1) y cuánto puede descentrarse (parte del lado de la guía). */
  docScanMinFill: envNumber(env, 'VITE_DOC_SCAN_MIN_FILL', 0.14, 0, 1),
  /** Cuánto del lado de la guía debe ocupar la caja de contenido (0-1): la señal de documento completo para la captura automática. */
  docScanMinCoverage: envNumber(env, 'VITE_DOC_SCAN_MIN_COVERAGE', 0.55, 0, 1),
  docScanCenterMax: envNumber(env, 'VITE_DOC_SCAN_CENTER_MAX', 0.18, 0, 1),
  /** Cuadros válidos seguidos antes de tomar la foto sola y desplazamiento medio (0-255) entre cuadros que cuenta como movimiento. */
  docScanStableFrames: envNumber(env, 'VITE_DOC_SCAN_STABLE_FRAMES', 12, 2, 30),
  docScanMaxShift: envNumber(env, 'VITE_DOC_SCAN_MAX_SHIFT', 7, 0, 64),
  /** Relación de aspecto de la guía (ancho/alto; genérica para v1). */
  docScanGuideAspect: envNumber(env, 'VITE_DOC_SCAN_GUIDE_ASPECT', 1.4, 0.5, 2),
  /** Cada cuánto se analiza un cuadro (ms) y, sin un cuadro válido, tras cuánto se habilita igual el obturador manual (ms). */
  docScanDetectIntervalMs: envNumber(env, 'VITE_DOC_SCAN_DETECT_INTERVAL_MS', 120, 50, 1000),
  docScanManualFallbackMs: envNumber(env, 'VITE_DOC_SCAN_MANUAL_FALLBACK_MS', 6000, 1000, 60000),
  /** Lado mayor (px) y calidad (0-1) del JPEG que se sube (más resolución que un rostro: el OCR lee texto). */
  docScanCapturePx: envNumber(env, 'VITE_DOC_SCAN_CAPTURE_PX', 1600, 640, 3000),
  docScanJpegQuality: envNumber(env, 'VITE_DOC_SCAN_JPEG_QUALITY', 0.85, 0.5, 1),

  // --- Registro de asistencia (ubicación) ---
  /**
   * Lecturas de la ubicación por registro: la más precisa decide (geocerca) y todas viajan para que el servidor
   * detecte una ubicación congelada o con la misma precisión siempre (simulador). La primera basta: las demás se
   * toman dentro de `locationSampleWindowMs`.
   */
  locationSamples: envNumber(env, 'VITE_LOCATION_SAMPLES', 3, 1, 10),
  locationSampleWindowMs: envNumber(env, 'VITE_LOCATION_SAMPLE_WINDOW_MS', 3000, 0, 15000),
  /**
   * "Mi ubicación" del mapa: si la lectura precisa falla (una computadora sin GPS), se pide una vez la de la red Wi-Fi,
   * aceptando una de hasta `locationNetworkMaxAgeMs` y esperando hasta `locationNetworkTimeoutMs`. Nunca en un registro.
   */
  locationNetworkMaxAgeMs: envNumber(env, 'VITE_LOCATION_NETWORK_MAX_AGE_MS', 300_000, 0, 3_600_000),
  locationNetworkTimeoutMs: envNumber(env, 'VITE_LOCATION_NETWORK_TIMEOUT_MS', 10_000, 1000, 30_000),

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
  /**
   * Antifraude 2b (firma por petición): si al identificar el reto vence en menos de este margen (o aún no hay), se pide
   * uno nuevo antes (`GET /checkpoint/me`); así la firma no llega vencida al servidor.
   */
  checkpointNonceMarginMs: seconds('VITE_CHECKPOINT_NONCE_MARGIN_SECONDS', 60, 10, 300),
  /**
   * Antifraude 2b (ubicación en cada identificación): la pantalla mantiene la ubicación "caliente"; una lectura sirve
   * mientras no tenga más de `checkpointLocationMaxAgeMs` y, sin una reciente, se espera la siguiente hasta
   * `checkpointLocationWaitMs` (después se identifica sin ella: decide el servidor).
   */
  checkpointLocationMaxAgeMs: seconds('VITE_CHECKPOINT_LOCATION_MAX_AGE_SECONDS', 30, 5, 300),
  checkpointLocationWaitMs: seconds('VITE_CHECKPOINT_LOCATION_WAIT_SECONDS', 8, 1, 30),

  // --- Kiosco del sitio (pantalla pública `/kiosk`: muestra el código que el empleado escanea o escribe) ---
  /** Sin conexión (o con el servidor fallando), los reintentos esperan cada vez el doble, hasta este tope. */
  kioskRetryMaxMs: seconds('VITE_KIOSK_RETRY_MAX_SECONDS', 60, 5, 600),
  /** El sitio desactivó su código (o el sitio no está activo): se vuelve a preguntar con esta calma. */
  kioskDisabledRetryMs: seconds('VITE_KIOSK_DISABLED_RETRY_SECONDS', 120, 15, 3600),

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

  // --- Analítica de uso (Firebase / Google Analytics 4) con candados de privacidad ---
  // Excepción documentada a la regla 13 (decisión del dueño del producto): solo pantallas como
  // plantilla y eventos sin datos de personas ni empresas. Por omisión solo en producción.
  analytics: {
    enabled: envBoolean(env, 'VITE_ANALYTICS_ENABLED', import.meta.env.PROD),
    firebase: {
      apiKey: envString(env, 'VITE_FIREBASE_API_KEY', ''),
      authDomain: envString(env, 'VITE_FIREBASE_AUTH_DOMAIN', ''),
      projectId: envString(env, 'VITE_FIREBASE_PROJECT_ID', ''),
      storageBucket: envString(env, 'VITE_FIREBASE_STORAGE_BUCKET', ''),
      messagingSenderId: envString(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID', ''),
      appId: envString(env, 'VITE_FIREBASE_APP_ID', ''),
      measurementId: envString(env, 'VITE_FIREBASE_MEASUREMENT_ID', ''),
    },
  },

  // --- Rendimiento visto desde el navegador (services/perf: Web Vitals, tareas largas y latencia de la API) ---
  // Solo plantillas de pantallas y de rutas con sus tiempos (sin ids, query ni datos de personas), al backend
  // propio (`POST /api/telemetry/web`); nunca a terceros.
  perf: {
    enabled: envBoolean(env, 'VITE_PERF_ENABLED', true),
    /** Parte de las cargas de la página que miden (0 = ninguna, 1 = todas): se decide una vez por carga. */
    sampleRate: envNumber(env, 'VITE_PERF_SAMPLE_RATE', 1, 0, 1),
    /** Cada cuánto se envía lo medido (además, al ocultarse o cerrarse la página). */
    flushMs: seconds('VITE_PERF_FLUSH_SECONDS', 30, 5, 300),
    /** Tope de muestras en memoria entre envíos (lo que sobra se descarta; el backend acepta hasta 500). */
    maxSamples: Math.floor(envNumber(env, 'VITE_PERF_MAX_SAMPLES', 300, 10, 500)),
    /** Tiempo límite de cada envío (sin reintentos: un lote que no llega se descarta). */
    timeoutMs: seconds('VITE_PERF_TIMEOUT_SECONDS', 5, 1, 30),
  },

  // --- Formularios y listados ---
  minEmployeeAge: envNumber(env, 'VITE_MIN_EMPLOYEE_AGE', 16, 14, 100),
  /**
   * Foto de perfil: tamaño máximo (MB) que se acepta antes de subirla. Solo ayuda a la persona (no espera una
   * subida que el servidor rechazará): el backend valida con su `AVATAR_MAX_MB`, que debe ser el mismo.
   */
  avatarMaxMb: envNumber(env, 'VITE_AVATAR_MAX_MB', 5, 1, 20),
  /** Lado mínimo (px) del recorte de la foto: el mismo `AVATAR_MIN_SIDE_PX` del backend (menos, lo rechaza). */
  avatarMinSidePx: envNumber(env, 'VITE_AVATAR_MIN_SIDE_PX', 128, 64, 512),
  /** Cuánto se puede acercar la foto al recortarla (veces el cuadrado más grande que cabe). */
  avatarMaxZoom: envNumber(env, 'VITE_AVATAR_MAX_ZOOM', 5, 1, 10),
  /** Fotos de perfil que la página conserva en memoria sin mostrarse (las que se ven nunca se descartan). */
  avatarCacheEntries: envNumber(env, 'VITE_AVATAR_CACHE_ENTRIES', 200, 20, 2000),
  /**
   * Documentos de una empresa: tamaño máximo (MB) que se acepta antes de subirlo. Solo ayuda a la persona (no espera
   * una subida que el servidor rechazará): el backend valida con su `COMPANY_DOCUMENT_MAX_MB`, que debe ser el mismo.
   */
  companyDocumentMaxMb: envNumber(env, 'VITE_COMPANY_DOCUMENT_MAX_MB', 20, 1, 25),
  /**
   * Documentos de identidad del empleado (onboarding con OCR): tamaño máximo (MB) antes de subirlo. Solo ayuda (el
   * backend valida con su `EMPLOYEE_DOCUMENT_MAX_MB`, que debe ser el mismo).
   */
  employeeDocumentMaxMb: envNumber(env, 'VITE_EMPLOYEE_DOCUMENT_MAX_MB', 15, 1, 25),
  /** Opciones de "por página" de todos los listados (el backend acepta hasta 50). */
  pageSizes,
  /** Elementos por página al abrir cualquier listado (una de las opciones). */
  pageSize: defaultPageSize,
} as const;

