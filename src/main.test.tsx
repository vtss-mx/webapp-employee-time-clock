import { StrictMode, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Arranque de la aplicación (main.tsx): limpia los datos de usuario que dejaron versiones anteriores
 * y monta la app en #root. Se simulan React DOM y App: aquí importa el arranque, no el dibujo.
 */
const dom = vi.hoisted(() => {
  const render = vi.fn<(element: ReactElement) => void>();
  return { render, createRoot: vi.fn((_container: Element) => ({ render })) };
});
vi.mock('react-dom/client', () => ({ createRoot: dom.createRoot }));
vi.mock('./App', () => ({ default: () => null }));

afterEach(() => {
  document.body.replaceChildren();
  vi.resetModules();
});

describe('arranque (main.tsx)', () => {
  it('borra lo que versiones anteriores dejaron en el navegador y monta la app en modo estricto dentro de #root', async () => {
    localStorage.setItem('tc.login.email', 'ana@empresa.com');
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await import('./main');

    expect(localStorage.getItem('tc.login.email')).toBeNull();
    expect(dom.createRoot).toHaveBeenCalledWith(root);
    expect(dom.render).toHaveBeenCalledOnce();
    const tree = dom.render.mock.calls[0][0] as ReactElement<{ children: ReactElement }>;
    expect(tree.type).toBe(StrictMode);
    expect(tree.props.children.type).toBe((await import('./App')).default);
  });

  it('sin el elemento #root falla con un error claro y no monta nada', async () => {
    dom.createRoot.mockClear();
    await expect(import('./main')).rejects.toThrow('No se encontró el elemento #root');
    expect(dom.createRoot).not.toHaveBeenCalled();
  });
});
