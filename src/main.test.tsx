import { StrictMode, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Arranque de la aplicación (main.tsx): limpia los datos de usuario que dejaron versiones anteriores,
 * descarga el idioma del dispositivo y monta la app en #root. Se simulan React DOM, App, el idioma y
 * la recarga por versión nueva: aquí importa el arranque, no el dibujo.
 */
const dom = vi.hoisted(() => {
  const render = vi.fn<(element: ReactElement) => void>();
  return { render, createRoot: vi.fn((_container: Element) => ({ render })) };
});
const boot = vi.hoisted(() => ({
  setLocale: vi.fn<(locale: string) => Promise<void>>(),
  initialLocale: vi.fn<() => Promise<string>>(),
  reloadForNewVersion: vi.fn<() => Promise<boolean>>(),
}));
vi.mock('react-dom/client', () => ({ createRoot: dom.createRoot }));
vi.mock('./App', () => ({ default: () => null }));
vi.mock('./i18n/core', () => ({ setLocale: boot.setLocale }));
vi.mock('./i18n/device', () => ({ initialLocale: boot.initialLocale }));
vi.mock('./services/versionReload', () => ({ reloadForNewVersion: boot.reloadForNewVersion }));

function page({ failure = true } = {}) {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  if (!failure) return { root, failure: null };
  const panel = document.createElement('div');
  panel.id = 'boot-error';
  panel.hidden = true;
  panel.innerHTML =
    '<div lang="es-MX" hidden><p>No se pudo cargar la aplicación.</p><button type="button">Reintentar</button></div>' +
    '<div lang="en-US" hidden><p>The app couldn\'t load.</p><button type="button">Retry</button></div>';
  document.body.append(panel);
  return { root, failure: panel };
}

beforeEach(() => {
  dom.createRoot.mockClear();
  dom.render.mockClear();
  boot.initialLocale.mockResolvedValue('en-US');
  boot.setLocale.mockResolvedValue(undefined);
  boot.reloadForNewVersion.mockResolvedValue(false);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.resetModules();
});

describe('arranque (main.tsx)', () => {
  it('borra lo que versiones anteriores dejaron en el navegador, carga el idioma del dispositivo y monta la app en modo estricto', async () => {
    localStorage.setItem('tc.login.email', 'ana@empresa.com');
    const { root, failure } = page();

    await import('./main');

    expect(localStorage.getItem('tc.login.email')).toBeNull();
    expect(boot.setLocale).toHaveBeenCalledWith('en-US'); // antes de dibujar: la app nunca se ve sin textos
    expect(dom.createRoot).toHaveBeenCalledWith(root);
    expect(dom.render).toHaveBeenCalledOnce();
    expect(failure?.hidden).toBe(true);
    const tree = dom.render.mock.calls[0][0] as ReactElement<{ children: ReactElement }>;
    expect(tree.type).toBe(StrictMode);
    expect(tree.props.children.type).toBe((await import('./App')).default);
  });

  it('sin el elemento #root falla con un error claro y no monta nada', async () => {
    await expect(import('./main')).rejects.toThrow('ROOT_ELEMENT_MISSING');
    expect(dom.createRoot).not.toHaveBeenCalled();
  });

  it('si el idioma no se descarga y hay una versión nueva, recarga (una vez) sin montar nada', async () => {
    boot.setLocale.mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    boot.reloadForNewVersion.mockResolvedValue(true);
    const { failure } = page();
    await import('./main');
    expect(dom.createRoot).not.toHaveBeenCalled();
    expect(failure?.hidden).toBe(true);
  });

  it('si fue la red, muestra el aviso SOLO en el idioma del dispositivo y su botón vuelve a intentar el arranque sin recargar la página', async () => {
    boot.setLocale.mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'));
    const { failure } = page();
    await import('./main');
    expect(failure?.hidden).toBe(false);
    expect(dom.createRoot).not.toHaveBeenCalled();
    // Nunca se mezclan idiomas: el dispositivo está en inglés, el aviso en español queda oculto.
    const notice = (lang: string) => failure?.querySelector<HTMLElement>(`[lang="${lang}"]`);
    expect(notice('en-US')?.hidden).toBe(false);
    expect(notice('es-MX')?.hidden).toBe(true);

    notice('en-US')?.querySelector('button')?.click();
    await vi.waitFor(() => expect(dom.render).toHaveBeenCalledOnce());
    expect(failure?.hidden).toBe(true);
    expect(boot.reloadForNewVersion).toHaveBeenCalledOnce();
  });

  it('sin el aviso en la página (index.html antiguo) solo espera: no monta una app sin textos', async () => {
    boot.setLocale.mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    page({ failure: false });
    await import('./main');
    expect(dom.createRoot).not.toHaveBeenCalled();
  });

  it('arranca aunque la página no tenga el aviso de falla', async () => {
    const { root } = page({ failure: false });
    await import('./main');
    expect(dom.createRoot).toHaveBeenCalledWith(root);
  });
});
