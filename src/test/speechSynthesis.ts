import { vi } from 'vitest';

/**
 * Síntesis de voz simulada para las pruebas (jsdom no la trae). Reproduce lo justo que usa `utils/speech.ts`
 * (`speechSynthesis.speak/cancel/getVoices` y el constructor `SpeechSynthesisUtterance`) y deja a la prueba leer lo que
 * se «dijo», contar las cancelaciones, fijar las voces del sistema y simular un navegador sin soporte.
 */

/** Un enunciado como lo arma `utils/speech.ts` (lo que la prueba verifica que se leyó). */
export class FakeUtterance {
  lang = '';
  pitch = 1;
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}

const state = {
  spoken: [] as FakeUtterance[],
  cancelled: 0,
  voices: [] as SpeechSynthesisVoice[],
};

const fakeSynthesis = {
  pending: false,
  speaking: false,
  paused: false,
  speak: vi.fn((utterance: FakeUtterance) => {
    state.spoken.push(utterance);
  }),
  cancel: vi.fn(() => {
    state.cancelled += 1;
  }),
  getVoices: vi.fn((): SpeechSynthesisVoice[] => state.voices),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
  onvoiceschanged: null,
};

/** Una voz del sistema de prueba: solo lo que mira `pickVoice` (nombre e idioma). */
export function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name };
}

/** Instala la síntesis simulada (motor y constructor) como lo haría un navegador que la soporta. */
export function installSpeechSynthesis(): void {
  Object.defineProperty(window, 'speechSynthesis', { value: fakeSynthesis, configurable: true, writable: true });
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = FakeUtterance;
}

/** Simula un navegador SIN síntesis de voz (para `speechSupported()` falso). Se restablece en `resetSpeech`. */
export function removeSpeechSupport(): void {
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true });
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = undefined;
}

/** Fija las voces que devuelve `getVoices()` (por omisión, ninguna). */
export function setVoices(voices: SpeechSynthesisVoice[]): void {
  state.voices = voices;
}

/** Los textos que se leyeron, en orden. */
export function spokenTexts(): string[] {
  return state.spoken.map((utterance) => utterance.text);
}

/** El último enunciado leído (para verificar perfil, idioma y voz elegida). */
export function lastUtterance(): FakeUtterance | undefined {
  return state.spoken.at(-1);
}

/** Cuántas veces se cortó lo que se estuviera diciendo. */
export function cancelCount(): number {
  return state.cancelled;
}

/** Deja la síntesis simulada como recién instalada (sin nada dicho, sin voces): lo llama `setup.ts` tras cada prueba. */
export function resetSpeech(): void {
  state.spoken = [];
  state.cancelled = 0;
  state.voices = [];
  fakeSynthesis.speak.mockClear();
  fakeSynthesis.cancel.mockClear();
  fakeSynthesis.getVoices.mockClear();
  installSpeechSynthesis();
}
