import { act, render, screen } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Floating } from './Floating';

/** Posición simulada del campo (jsdom no calcula diseño). */
let anchorRect = { top: 100, bottom: 140, left: 30, width: 200, height: 40 };

interface FieldProps {
  withAnchor?: boolean;
  matchWidth?: boolean;
  minWidth?: number;
  align?: 'start' | 'end';
}

function Field({ withAnchor = true, matchWidth = false, minWidth, align }: FieldProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const missing: RefObject<HTMLElement | null> = { current: null };
  return (
    <>
      <div ref={anchorRef} data-anchor="" />
      <Floating anchorRef={withAnchor ? anchorRef : missing} className="menu" matchWidth={matchWidth} minWidth={minWidth} align={align}>
        opciones
      </Floating>
    </>
  );
}

const surface = () => screen.getByText('opciones');
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

beforeEach(() => {
  anchorRect = { top: 100, bottom: 140, left: 30, width: 200, height: 40 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return ('anchor' in this.dataset ? anchorRect : { top: 0, bottom: 0, left: 0, width: 0, height: 0 }) as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(180);
});
afterEach(() => vi.unstubAllGlobals());

describe('Floating', () => {
  it('se abre bajo el campo con el ancho de su contenido (o el del campo)', () => {
    const { unmount } = render(<Field />);
    expect(surface()).toHaveStyle({ top: '146px', left: '30px' });
    expect(surface()).not.toHaveClass('floating--above');
    unmount();
    render(<Field matchWidth />);
    expect(surface()).toHaveStyle({ width: '200px' });
  });

  it('con ancho mínimo: nunca más angosta que él, también cuando iguala el ancho del campo', () => {
    const { unmount } = render(<Field matchWidth minWidth={260} />);
    expect(surface()).toHaveStyle({ width: '260px', minWidth: '260px' });
    unmount();
    render(<Field minWidth={100} />); // el contenido (180) ya es más ancho: el mínimo solo se declara
    expect(surface()).toHaveStyle({ minWidth: '100px', left: '30px' });
  });

  it('alineada al borde derecho del campo (un control pegado a la derecha) sin salirse de la pantalla', () => {
    anchorRect = { top: 100, bottom: 140, left: 700, width: 120, height: 40 }; // termina en 820
    const { unmount } = render(<Field align="end" matchWidth minWidth={260} />);
    expect(surface()).toHaveStyle({ left: '560px', width: '260px' }); // 820 − 260
    unmount();
    anchorRect = { top: 100, bottom: 140, left: 0, width: 120, height: 40 }; // a la izquierda: no cabe hacia la izquierda
    render(<Field align="end" matchWidth minWidth={260} />);
    expect(surface()).toHaveStyle({ left: '16px' }); // el margen con el borde
  });

  it('si abajo no cabe y arriba hay más espacio, se abre hacia arriba', () => {
    anchorRect = { top: 700, bottom: 740, left: 30, width: 200, height: 40 };
    render(<Field />);
    expect(surface()).toHaveClass('floating--above');
    expect(surface()).toHaveStyle({ top: '394px' }); // 700 − 6 − 300
  });

  it('sin el campo en pantalla no se coloca: queda oculta', () => {
    render(<Field withAnchor={false} />);
    expect(surface()).toHaveStyle({ visibility: 'hidden' });
  });

  it('se recoloca al cambiar el tamaño de la ventana o el de la superficie; al cerrar deja de observar', async () => {
    const observers: Array<{ callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(public callback: () => void) {
          observers.push(this);
        }
      },
    );
    const { unmount } = render(<Field />);
    expect(observers[0].observe).toHaveBeenCalledWith(surface());

    anchorRect = { ...anchorRect, top: 200, bottom: 240 };
    act(() => void window.dispatchEvent(new Event('resize')));
    await nextFrame();
    expect(surface()).toHaveStyle({ top: '246px' });

    anchorRect = { ...anchorRect, top: 250, bottom: 290 };
    act(() => observers[0].callback()); // cambió el alto de la lista (p. ej. al filtrar)
    await nextFrame();
    expect(surface()).toHaveStyle({ top: '296px' });

    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });
});
