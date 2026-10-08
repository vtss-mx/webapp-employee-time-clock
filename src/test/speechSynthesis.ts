import { vi } from 'vitest';
import { resetSpeechState } from '../utils/speech';

/**
 * Síntesis de voz simulada para las pruebas (jsdom no la trae). Reproduce lo justo que usa `utils/speech.ts`
 * (`speechSynthesis.speak/cancel/getVoices`, el evento `voiceschanged` y el constructor `SpeechSynthesisUtterance`) y
 * deja a la prueba leer lo que se «dijo», contar las cancelaciones, fijar las voces del sistema (con su calidad), simular
 * que el navegador carga las voces tarde (`fireVoicesChanged`) y simular un navegador sin soporte.
 */

/** Un enunciado como lo arma `utils/speech.ts` (lo que la prueba verifica que se leyó; `volume` para el desbloqueo). */
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
  /** Los escuchas de `voiceschanged` que enganchó `utils/speech.ts` (para dispararlos con `fireVoicesChanged`). */
  voicesListeners: [] as EventListenerOrEventListenerObject[],
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
  addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'voiceschanged') state.voicesListeners.push(listener);
  }),
  removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'voiceschanged') state.voicesListeners = state.voicesListeners.filter((registered) => registered !== listener);
  }),
  dispatchEvent: vi.fn(() => true),
  onvoiceschanged: null,
};

/** Opciones de una voz de prueba: su calidad declarada (local sin red, o la marcada por omisión del sistema). */
interface FakeVoiceOptions {
  localService?: boolean;
  default?: boolean;
}

/** Una voz del sistema de prueba: nombre e idioma (que mira `pickVoice`) y, opcional, su calidad (`voiceQuality`). */
export function fakeVoice(name: string, lang: string, options: FakeVoiceOptions = {}): SpeechSynthesisVoice {
  return { name, lang, default: options.default ?? false, localService: options.localService ?? true, voiceURI: name };
}

/** Simula que el navegador cargó las voces tarde (Blink): dispara el `voiceschanged` que enganchó `utils/speech.ts`. */
export function fireVoicesChanged(): void {
  const event = new Event('voiceschanged');
  for (const listener of [...state.voicesListeners]) {
    if (typeof listener === 'function') listener(event);
    else listener.handleEvent(event);
  }
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
  state.voicesListeners = [];
  fakeSynthesis.speak.mockClear();
  fakeSynthesis.cancel.mockClear();
  fakeSynthesis.getVoices.mockClear();
  fakeSynthesis.addEventListener.mockClear();
  fakeSynthesis.removeEventListener.mockClear();
  resetSpeechState(); // el caché de voces, el `voiceschanged` enganchado y el desbloqueo vuelven a empezar
  installSpeechSynthesis();
}
