import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { setLocale } from './i18n/core';
import { initialLocale } from './i18n/device';
import { reloadForNewVersion } from './services/versionReload';
import { purgeLegacyStorage } from './utils/legacyStorage';

/**
 * El aviso de `index.html` (#boot-error) en el idioma del dispositivo y SOLO en ese (regla 16: nunca se mezclan
 * idiomas): sus textos ya están en la página porque el diccionario no llegó. Su botón vuelve a intentar el arranque.
 */
function showBootError(failure: HTMLElement, locale: string): void {
  failure.hidden = false;
  failure.querySelectorAll<HTMLElement>('[lang]').forEach((notice) => {
    notice.hidden = notice.lang !== locale;
    if (!notice.hidden) notice.querySelector('button')?.addEventListener('click', () => void start(), { once: true });
  });
}

/**
 * Arranque: borra lo que dejaron versiones anteriores en Web Storage, descarga el diccionario del
 * idioma del dispositivo (`initialLocale`: su última elección, el navegador o es-MX; el otro idioma no
 * se descarga) y monta la app. Si el diccionario no llega ni reintentando: una versión nueva recarga
 * una vez; si fue la red, se muestra el aviso de `index.html` en el idioma del dispositivo y su botón
 * vuelve a intentar el arranque sin recargar la página.
 */
export async function start(): Promise<void> {
  purgeLegacyStorage();
  const container = document.getElementById('root');
  if (!container) throw new Error('ROOT_ELEMENT_MISSING');
  const failure = document.getElementById('boot-error');
  const locale = await initialLocale();
  try {
    await setLocale(locale);
  } catch {
    if (await reloadForNewVersion()) return;
    if (failure) showBootError(failure, locale);
    return;
  }
  if (failure) failure.hidden = true;
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

await start();
