// El reto de la prueba de vida y el protocolo de captura de frontera (antifraude 2a): lo que pide además de los
// movimientos (destello dictado por el servidor y ráfaga de recortes del rostro).

/** Destello dictado por el servidor: el token con que se pide el primer color, cuántos son y la ventana de cada uno. */
export interface FlashPace {
  token: string;
  total: number;
  window_ms: number;
}

/**
 * La ráfaga corta de recortes del rostro que pide el servidor (decisión D11): lado de cada recorte, cuántos del tramo
 * quieto y del de movimiento, cuadros por segundo, calidad JPEG de la hoja, cuánto más grande que el rostro es la
 * zona recortada, el tamaño máximo de la hoja (bytes) y los recortes mínimos (con menos no se manda). Nunca se guarda:
 * el servidor la analiza y la descarta.
 */
export interface BurstSpec {
  tile: number;
  hold: number;
  move: number;
  fps: number;
  quality: number;
  margin: number;
  max_bytes: number;
  min_frames: number;
}

/**
 * Lo que el reto agrega para el protocolo de captura: el destello dictado por el servidor (entonces `flash` va vacío:
 * los colores se piden uno por uno por el canal en vivo) y la ráfaga que se pide con las capturas. Null/ausente: no se
 * usan.
 */
export interface ChallengeCapture {
  flash_pace?: FlashPace | null;
  burst?: BurstSpec | null;
}

/**
 * Movimientos que puede pedir la prueba de vida (catálogo `liveness_actions`): girar a la izquierda o
 * a la derecha (de la persona), mirar arriba, mirar abajo o acercarse a la cámara.
 */
export type LivenessAction = 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_UP' | 'LOOK_DOWN' | 'MOVE_CLOSER';

/**
 * Reto de prueba de vida (de uso único): la pantalla destella los colores de `flash` (una captura por
 * color) y la persona hace cada movimiento de `actions` (una captura por movimiento), antes de
 * `expires_in` segundos. Los mínimos son los vigentes de la plataforma (se endurecen solos).
 * Con el destello dictado y la ráfaga del antifraude 2a (`ChallengeCapture`).
 */
export interface FaceChallenge extends ChallengeCapture {
  liveness_required: boolean;
  challenge_id: string | null;
  /** Primer movimiento (igual a `actions[0]`). */
  action: LivenessAction | null;
  instruction: string | null;
  /** Movimientos en orden (de uno a tres; nunca el mismo dos veces seguidas). */
  actions: LivenessAction[];
  instructions: string[];
  /** Giro mínimo (nariz respecto a los ojos / distancia entre ojos). */
  min_yaw_ratio: number | null;
  /** Cambio mínimo de la nariz entre ojos y boca al mirar arriba o abajo (contra las frontales). */
  min_pitch_delta: number | null;
  /** Cuántas veces debe crecer el ancho del rostro al acercarse (contra las frontales). */
  min_closer_scale: number | null;
  /** Colores del destello en orden ('#RRGGBB'); vacío si la empresa no lo usa. */
  flash: string[];
  /** El destello es obligatorio (sin él, el servidor responde LIVENESS_REQUIRED); si no, solo se mide. */
  flash_required: boolean;
  /** Segundos de vida del reto (política de la empresa). */
  expires_in: number | null;
  /** Reto de "un paso más" que pidió el motor de riesgo: más movimientos y el destello obligatorio. */
  step_up?: boolean;
  /**
   * Reto que firma la llave de este dispositivo (`utils/deviceKey.ts`) y vuelve con las capturas: solo para el
   * propio empleado y si su empresa vincula dispositivos (decisión D2). Null/ausente: no se firma nada.
   */
  device_nonce?: string | null;
}
