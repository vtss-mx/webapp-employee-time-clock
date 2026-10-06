import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { setLocale } from './i18n/core';
import { initialLocale } from './i18n/device';
import { reloadForNewVersion } from './services/versionReload';
import { purgeLegacyStorage } from './utils/legacyStorage';

/**
 * Arranque: borra lo que dejaron versiones anteriores en Web Storage, descarga el diccionario del
 * idioma del dispositivo (`initialLocale`: su última elección, el navegador o es-MX; el otro idioma no
 * se descarga) y monta la app. Si el diccionario no llega ni reintentando: una versión nueva recarga
 * una vez; si fue la red, se muestra el aviso bilingüe de `index.html` (#boot-error) y su botón vuelve
 * a intentar el arranque sin recargar la página.
 */
export async function start(): Promise<void> {
  purgeLegacyStorage();
  const container = document.getElementById('root');
  if (!container) throw new Error('No se encontró el elemento #root');
  const failure = document.getElementById('boot-error');
  try {
    await setLocale(await initialLocale());
  } catch {
    if (await reloadForNewVersion()) return;
    if (failure) {
      failure.hidden = false;
      failure.querySelector('button')?.addEventListener('click', () => void start(), { once: true });
    }
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
