import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as lazyPages from './lazyPages';

type Loader = () => Promise<{ default: ComponentType }>;

/**
 * Cada pantalla diferida apunta a un módulo que existe y exporta su componente. Se intercepta
 * `retryableLazy` para quedarse con la función de carga de cada export (la que React llamaría al
 * dibujarla) y ejecutarla aquí: una ruta o un nombre mal escrito fallaría solo al visitar la pantalla.
 */
const loaders = vi.hoisted(() => new Map<unknown, Loader>());
vi.mock('../components/retryableLazy', () => ({
  retryableLazy: (load: Loader) => {
    const placeholder = () => null;
    loaders.set(placeholder, load);
    return placeholder;
  },
}));

// Se recorre lo que exporta el módulo (no una lista fija): una pantalla nueva queda cubierta sola.
const pages = Object.entries<ComponentType>(lazyPages);

describe('pantallas diferidas (lazyPages)', () => {
  it('cada export es una carga diferida', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const [, page] of pages) expect(loaders.has(page)).toBe(true);
  });

  it.each(pages)('%s descarga su módulo y entrega el componente con ese nombre', async (name, page) => {
    window.history.replaceState({ tcReloadedAt: Date.now() }, ''); // recarga previa por versión nueva
    const loaded = await (loaders.get(page) as Loader)();
    expect(typeof loaded.default).toBe('function');
    expect(loaded.default.name).toBe(name);
    // Cargar bien una pantalla confirma que esta versión funciona: se libera la marca de recarga.
    expect(window.history.state).toEqual({});
  });
});
