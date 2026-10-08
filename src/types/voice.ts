/** Verificación por voz y video del registro facial (decisión del dueño del producto, 2026-10-06). */

/**
 * Pregunta de la verificación por voz (catálogo `voice_questions`). Repertorio ampliado 2026-10-07: nombre, apellidos,
 * nombre completo, fecha/mes/año/día de nacimiento, empresa, número, departamento, sitio, primer/segundo apellido y una
 * suma al azar como prueba cognitiva (`ARITHMETIC_SUM`). El servidor elige al azar cuáles y las que puede hacer.
 */
export type VoiceQuestionKind =
  | 'FULL_NAME'
  | 'BIRTH_DATE'
  | 'COMPANY_NAME'
  | 'EMPLOYEE_NUMBER'
  | 'DEPARTMENT'
  | 'WORK_SITE'
  | 'FIRST_NAME'
  | 'SURNAMES'
  | 'FIRST_SURNAME'
  | 'SECOND_SURNAME'
  | 'BIRTH_MONTH'
  | 'BIRTH_YEAR'
  | 'BIRTH_DAY'
  | 'ARITHMETIC_SUM';

export interface VoiceQuestion {
  position: number;
  question: VoiceQuestionKind;
  /**
   * El TEXTO de la pregunta YA RENDERIZADO por el servidor en el idioma de la petición (decisión del dueño,
   * 2026-10-07): la app solo lo muestra. La suma llega con sus números sustituidos («¿Cuánto es 7 más 4?»).
   */
  text: string;
}

/**
 * La verificación por voz y video que sigue a las fotos del registro (decisión del dueño, 2026-10-06): el token sellado
 * de la sesión (viaja con cada respuesta y vuelve renovado), las preguntas que FALTAN en orden (decisión del dueño,
 * 2026-10-07: el paso 3 se retoma otro día; las ya aceptadas se conservan: `answered` de `total`), cuánto debe durar cada
 * respuesta, los intentos por pregunta y la vida de la sesión (s).
 */
export interface VoiceChallenge {
  token: string;
  questions: VoiceQuestion[];
  /** Preguntas de la sesión completa y cuántas ya tienen su respuesta aceptada («Pregunta 2 de 3»). */
  total: number;
  answered: number;
  min_seconds: number;
  max_seconds: number;
  retries: number;
  expires_in: number;
}

/** Una respuesta aceptada: el token renovado, qué pregunta fue, si ya pasaron todas y cuál sigue. */
export interface VoiceAnswerResult {
  token: string;
  position: number;
  done: boolean;
  next_position: number | null;
}

/** Lo que la empresa ve de cada respuesta aceptada al revisar el registro. */
export interface VoiceAnswer {
  id: number;
  position: number;
  question: VoiceQuestionKind;
  /** Intentos que tomó la pregunta (1 = a la primera). */
  attempts: number;
  /** Lo que se oyó (las palabras de la persona: un dato) y los parecidos medidos (0-1). */
  transcript: string | null;
  similarity: number | null;
  face_similarity: number | null;
  duration_ms: number;
  created_at: string;
  /** El clip sigue en el bucket (sale a los FACE_VIDEO_RETENTION_DAYS). */
  has_clip: boolean;
}

/** La verificación por voz de un registro: si pasó, cuántas respuestas no pasaron y las aceptadas. */
export interface EnrollmentVoice {
  required: boolean;
  passed_at: string | null;
  failed_attempts: number;
  answers: VoiceAnswer[];
}

/** El video de una respuesta: descifrado y en base64 dentro del contrato (nunca una URL del bucket). */
export interface VoiceClip {
  content_type: string;
  data: string;
  byte_size: number;
  duration_ms: number;
}
