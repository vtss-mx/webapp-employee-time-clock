import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WithCatalogs } from '../test/render';
import { config } from '../utils/config';
import type { ActionMode } from '../utils/facePose';
import { FlashOverlay } from './FlashOverlay';
import { ActionCue, ScannerHints } from './LivenessCues';

const mode = (action: ActionMode['action'], minimum = 0.2): ActionMode => ({ kind: 'action', action, minimum, baseline: null });
const overlay = () => document.querySelector<HTMLElement>('.flash');

describe('FlashOverlay: destello de colores', () => {
  it('sin color no se dibuja nada', () => {
    render(<FlashOverlay color={null} index={0} total={0} />);
    expect(overlay()).toBeNull();
  });

  it('pinta la pantalla completa (portal) con el color, la indicación y el avance de los colores', () => {
    const { container } = render(<FlashOverlay color="#FF0000" index={1} total={3} />);
    expect(container).toBeEmptyDOMElement(); // vive en el body, sobre todo lo demás
    expect(overlay()?.style.getPropertyValue('--flash-color')).toBe('#FF0000');
    expect(overlay()).not.toHaveClass('flash--window');
    expect(overlay()).toHaveAttribute('role', 'status');
    expect(overlay()).toHaveTextContent('Mantén tu rostro frente a la pantalla');
    const steps = overlay()?.querySelector('.flash__steps');
    expect(steps).toHaveAttribute('aria-label', 'Color 2 de 3');
    expect([...(steps?.children ?? [])].map((li) => li.className)).toEqual(['is-done', 'is-current', '']);
  });

  it('deja una ventana circular sobre el anillo (medida al empezar, con cada color y en el cuadro siguiente)', async () => {
    const rects = [new DOMRect(10, 30, 200, 200), new DOMRect(10, 20, 200, 200)];
    const locate = vi.fn(() => rects.shift() ?? new DOMRect(10, 20, 200, 200));
    const { rerender } = render(<FlashOverlay color="#00FF00" index={0} total={2} locate={locate} hint="Quédate quieto" />);
    expect(overlay()).toHaveClass('flash', 'flash--window');
    const hole = () => ['--flash-x', '--flash-y', '--flash-rx', '--flash-ry'].map((name) => overlay()?.style.getPropertyValue(name));
    expect(hole()).toEqual(['110px', '130px', '100px', '100px']); // antes de pintar
    // El visor se acomoda un instante después (cambia el título de la etapa): el siguiente cuadro corrige la ventana.
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
    expect(hole()).toEqual(['110px', '120px', '100px', '100px']);
    expect(overlay()).toHaveTextContent('Quédate quieto');
    rerender(<FlashOverlay color="#0000FF" index={1} total={2} locate={locate} hint="Quédate quieto" />);
    expect(overlay()?.style.getPropertyValue('--flash-color')).toBe('#0000FF');
    expect(locate).toHaveBeenCalledTimes(3); // al empezar, el cuadro siguiente y el color nuevo
  });

  it('si el círculo no tiene medida (oculto) o no se encuentra, todo se pinta de color', () => {
    const { unmount } = render(<FlashOverlay color="#00FF00" index={0} total={1} locate={() => new DOMRect(0, 0, 0, 0)} />);
    expect(overlay()).not.toHaveClass('flash--window');
    unmount();
    render(<FlashOverlay color="#00FF00" index={0} total={1} locate={() => null} />);
    expect(overlay()).not.toHaveClass('flash--window');
    expect(overlay()?.style.getPropertyValue('--flash-x')).toBe('');
  });
});

describe('LivenessCues: señal de cada movimiento', () => {
  const cue = (action: ActionMode['action'], mirrored = true) => render(<ActionCue mode={mode(action, action === 'MOVE_CLOSER' ? 1.25 : 0.2)} mirrored={mirrored} />).container;
  const side = (container: HTMLElement) => container.querySelector('.ring-cue')?.className;

  it('girar: el arco y la punta sobre el anillo del lado de la persona según el espejo de la cámara', () => {
    const left = cue('TURN_LEFT');
    expect(side(left)).toBe('ring-cue ring-cue--left');
    expect(left.querySelector('.ring-cue__arc')?.getAttribute('stroke')).toMatch(/^url\(#cue-[\w-]+\)$/);
    expect(left.querySelectorAll('.ring-cue__pointer path')).toHaveLength(2); // contorno blanco y punta
    expect(side(cue('TURN_LEFT', false))).toBe('ring-cue ring-cue--right');
    expect(side(cue('TURN_RIGHT'))).toBe('ring-cue ring-cue--right');
    expect(side(cue('TURN_RIGHT', false))).toBe('ring-cue ring-cue--left');
  });

  it('mirar arriba o abajo: el lado de arriba o de abajo; acercarse: ondas hasta el tamaño al que debe crecer el rostro', () => {
    expect(side(cue('LOOK_UP'))).toBe('ring-cue ring-cue--up');
    expect(side(cue('LOOK_DOWN'))).toBe('ring-cue ring-cue--down');
    const closer = cue('MOVE_CLOSER').querySelector<HTMLElement>('.ring-cue--closer');
    expect(Number(closer?.style.getPropertyValue('--closer-scale'))).toBeCloseTo(1.25 + config.faceCloserMargin);
    expect(closer?.querySelectorAll('.ring-cue__ripple')).toHaveLength(2);
    expect(closer?.querySelector('.ring-cue__arc')).toBeNull();
  });

  it('sobre el rostro: accesorios en un bloqueo; la señal solo mientras falta hacer el movimiento', () => {
    const hints = (props: Partial<Parameters<typeof ScannerHints>[0]>) =>
      render(<ScannerHints phase="challenge" guidance="move" mode={mode('LOOK_UP')} mirrored accessories={[]} {...props} />, { wrapper: WithCatalogs }).container;
    expect(hints({ phase: 'blocked', accessories: ['GLASSES'] }).querySelector('.accessory-alert')).toHaveTextContent('Lentes');
    expect(hints({}).querySelector('.ring-cue--up')).not.toBeNull();
    expect(hints({ guidance: 'hold_still' })).toBeEmptyDOMElement();
    expect(hints({ guidance: 'ready' })).toBeEmptyDOMElement();
    expect(hints({ phase: 'recenter', mode: null })).toBeEmptyDOMElement();
  });
});
