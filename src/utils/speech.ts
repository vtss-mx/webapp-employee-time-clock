/**
 * Guía por voz del registro facial (decisión del dueño, 2026-10-08): el ÚNICO módulo que toca
 * `window.speechSynthesis`. La síntesis la hace el propio dispositivo (sin servicios externos: privacidad
 * por diseño, regla 13). Todo está protegido por `typeof` y NO hace nada si el navegador no la soporta
 * (como el candado de `AudioContext` en `useAnswerRecorder`): un dispositivo sin síntesis no falla ni
 * cuelga el flujo, solo no se oye la guía.
 *
 * Cada voz del catálogo `voice_profiles` fija aquí su género, tono y ritmo (`PROFILE_PARAMS`): el servidor
 * solo guarda el CÓDIGO del perfil y lo valida contra el catálogo; cómo suena es del cliente.
 */

/** Género con que se busca la voz del sistema; `any` deja la que ya trae por omisión el dispositivo. */
export type VoiceGender = 'female' | 'male' | 'any';

/** Parámetros de síntesis de un perfil de voz: a quién se parece y qué tan agudo y rápido habla. */
export interface ProfileParams {
  gender: VoiceGender;
  /** Tono (1 = natural; más alto, más agudo). Rango de la API: 0–2. */
  pitch: number;
  /** Ritmo (1 = natural; más bajo, más pausado). Rango de la API: 0.1–10. */
  rate: number;
}

/**
 * Los cinco perfiles del contrato (2026-10-08). Son constantes del cliente (no configuración del `.env`:
 * definen cómo suena cada perfil, no un parámetro de despliegue). El código es el del catálogo `voice_profiles`.
 */
export const PROFILE_PARAMS: Record<string, ProfileParams> = {
  FEMALE_WARM: { gender: 'female', pitch: 1.05, rate: 1.0 },
  FEMALE_CLEAR: { gender: 'female', pitch: 1.15, rate: 0.92 },
  MALE_CALM: { gender: 'male', pitch: 0.95, rate: 1.0 },
  MALE_DEEP: { gender: 'male', pitch: 0.8, rate: 0.95 },
  NEUTRAL: { gender: 'any', pitch: 1.0, rate: 1.0 },
};

/** Perfil por omisión del contrato (si llega un código desconocido se usan sus parámetros, nunca se rompe). */
const DEFAULT_PROFILE = 'FEMALE_WARM';

/** El motor de síntesis del dispositivo, o `null` si el navegador no lo expone (SSR, navegador antiguo). */
function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' ? window.speechSynthesis : null;
}

/** ¿El dispositivo puede leer en voz alta? (motor + constructor de enunciados). */
export function speechSupported(): boolean {
  return synth() !== null && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Idioma de una voz, normalizado a minúsculas y con guiones (`es_MX` → `es-mx`). */
function voiceLang(voice: SpeechSynthesisVoice): string {
  return voice.lang.replace(/_/g, '-').toLowerCase();
}

const FEMALE_WORDS = /\b(female|femenin[ao]|mujer|femme|weiblich|femminile|feminin[ao]|woman)\b/;
const MALE_WORDS = /\b(male|masculin[ao]|hombre|homme|männlich|maschile|man)\b/;
/** Nombres frecuentes de voces del sistema por género (mejor esfuerzo; completa la pista del nombre). */
const FEMALE_NAMES = new Set(['paulina', 'mónica', 'monica', 'samantha', 'victoria', 'zira', 'luciana', 'amelie', 'anna', 'alice', 'sabina', 'helena', 'laura', 'joana']);
const MALE_NAMES = new Set(['jorge', 'diego', 'juan', 'carlos', 'daniel', 'thomas', 'fred', 'david', 'luca', 'yannick', 'reed', 'arthur']);

/** Género probable de una voz por su nombre (null = no se pudo deducir; decide el orden del sistema). */
function genderOf(voice: SpeechSynthesisVoice): VoiceGender | null {
  const name = voice.name.toLowerCase();
  if (FEMALE_WORDS.test(name)) return 'female';
  if (MALE_WORDS.test(name)) return 'male';
  const first = name.split(/[^a-záéíóúñ]+/i)[0];
  if (FEMALE_NAMES.has(first)) return 'female';
  if (MALE_NAMES.has(first)) return 'male';
  return null;
}

/**
 * La mejor voz del sistema para un idioma y género: primero las del idioma exacto, luego las del mismo idioma base
 * (`es` de `es-mx`) y, sin ninguna, todas; dentro del grupo, la que coincide con el género pedido. `null` si el
 * dispositivo aún no tiene voces (se usa el idioma del enunciado y la voz por omisión).
 */
export function pickVoice(locale: string, gender: VoiceGender): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  if (voices.length === 0) return null;
  const wanted = locale.replace(/_/g, '-').toLowerCase();
  const base = wanted.split('-')[0];
  const exact = voices.filter((voice) => voiceLang(voice) === wanted);
  const sameBase = voices.filter((voice) => voiceLang(voice).split('-')[0] === base);
  const pool = exact.length > 0 ? exact : sameBase.length > 0 ? sameBase : voices;
  if (gender !== 'any') {
    const match = pool.find((voice) => genderOf(voice) === gender);
    if (match) return match;
  }
  return pool[0];
}

/** Opciones de `speak`: con qué perfil (código del catálogo), en qué idioma y si corta lo que se estuviera diciendo. */
export interface SpeakOptions {
  profile?: string;
  locale: string;
  /** Corta la frase anterior para que las indicaciones no se encimen (por omisión, sí). */
  interrupt?: boolean;
}

/**
 * Lee un texto en voz alta con el perfil elegido. No hace nada si el navegador no soporta síntesis o el texto está
 * vacío. `interrupt` (por omisión) cancela lo que se estuviera diciendo: cada indicación reemplaza a la anterior.
 */
export function speak(text: string, { profile, locale, interrupt = true }: SpeakOptions): void {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined' || !text) return;
  const params = PROFILE_PARAMS[profile ?? ''] ?? PROFILE_PARAMS[DEFAULT_PROFILE];
  if (interrupt) s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.pitch = params.pitch;
  utterance.rate = params.rate;
  const voice = pickVoice(locale, params.gender);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  s.speak(utterance);
}

/** Calla la guía por voz (al desmontar el flujo o al silenciarla): sin motor, no hace nada. */
export function cancelSpeech(): void {
  synth()?.cancel();
}
