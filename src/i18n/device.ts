/**
 * El idioma de ESTE dispositivo (para el inicio de sesión y quien no ha entrado): la última elección
 * en IndexedDB (`deviceStore`, nunca localStorage) y, si no hay, los idiomas del navegador. El de la
 * persona vive en la BD (`user.preferences.locale`) y manda en cuanto inicia sesión (`LocaleSync`).
 */
import { deviceStore } from '../utils/deviceStore';
import { sleep } from '../utils/waits';
import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from './core';

const DEVICE_KEY = 'locale';
/** IndexedDB puede tardar o no responder (modo privado estricto): no se espera más que esto. */
const DEVICE_READ_TIMEOUT_MS = 1500;

/** La última elección guardada en este dispositivo, o null (sin elección, sin IndexedDB o sin respuesta a tiempo). */
export async function deviceLocale(timeoutMs = DEVICE_READ_TIMEOUT_MS): Promise<Locale | null> {
  const timer = new AbortController();
  try {
    const stored = await Promise.race([deviceStore.get(DEVICE_KEY), sleep(timeoutMs, timer.signal).then(() => null)]);
    return isLocale(stored) ? stored : null;
  } finally {
    timer.abort(); // la pausa termina en cuanto respondió IndexedDB
  }
}

/** El primer idioma del navegador que la app tiene (`es*` → es-MX, `en*` → en-US), o null. */
export function browserLocale(languages: readonly string[] = [...navigator.languages, navigator.language]): Locale | null {
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return null;
}

/** Idioma al abrir la app: el del dispositivo, el del navegador o es-MX. */
export async function initialLocale(): Promise<Locale> {
  return (await deviceLocale()) ?? browserLocale() ?? DEFAULT_LOCALE;
}

/** Recuerda el idioma en este dispositivo (accesorio: sin IndexedDB, simplemente no se recuerda). */
export function rememberDeviceLocale(locale: Locale): Promise<void> {
  return deviceStore.set(DEVICE_KEY, locale);
}
