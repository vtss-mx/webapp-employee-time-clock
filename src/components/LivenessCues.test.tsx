import { render } from '@testing-library/react';
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

  it('deja una ventana elíptica sobre el óvalo (medido al empezar) para seguir viendo la cámara', () => {
    const locate = vi.fn(() => new DOMRect(10, 20, 200, 300));
    const { rerender } = render(<FlashOverlay color="#00FF00" index={0} total={2} locate={locate} hint="Quédate quieto" />);
    expect(overlay()).toHaveClass('flash', 'flash--window');
    const style = overlay()?.style;
    expect(['--flash-x', '--flash-y', '--flash-rx', '--flash-ry'].map((name) => style?.getPropertyValue(name))).toEqual(['110px', '170px', '100px', '150px']);
    expect(overlay()).toHaveTextContent('Quédate quieto');
    rerender(<FlashOverlay color="#0000FF" index={1} total={2} locate={locate} hint="Quédate quieto" />);
    expect(overlay()?.style.getPropertyValue('--flash-color')).toBe('#0000FF');
    expect(locate).toHaveBeenCalledOnce(); // el visor no se mueve durante el destello
  });

  it('si el óvalo no tiene medida (oculto) o no se encuentra, todo se pinta de color', () => {
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

  it('girar: la flecha apunta al lado de la persona según el espejo de la cámara', () => {
    expect(cue('TURN_LEFT').querySelector('.turn-arrow .lucide-arrow-left')).not.toBeNull();
    expect(cue('TURN_LEFT', false).querySelector('.lucide-arrow-right')).not.toBeNull();
    expect(cue('TURN_RIGHT').querySelector('.lucide-arrow-right')).not.toBeNull();
    expect(cue('TURN_RIGHT', false).querySelector('.lucide-arrow-left')).not.toBeNull();
  });

  it('mirar arriba o abajo: doble flecha hacia donde mirar; acercarse: el óvalo al que debe crecer el rostro', () => {
    expect(cue('LOOK_UP').querySelector('.tilt-cue--up .lucide-chevrons-up')).not.toBeNull();
    expect(cue('LOOK_DOWN').querySelector('.tilt-cue--down .lucide-chevrons-down')).not.toBeNull();
    const closer = cue('MOVE_CLOSER').querySelector<HTMLElement>('.closer-cue');
    expect(Number(closer?.style.getPropertyValue('--closer-scale'))).toBeCloseTo(1.25 + config.faceCloserMargin);
    expect(closer?.querySelector('.closer-cue__target')).not.toBeNull();
    expect(closer?.querySelector('.lucide-zoom-in')).not.toBeNull();
  });

  it('sobre el rostro: accesorios en un bloqueo; la señal solo mientras falta hacer el movimiento', () => {
    const hints = (props: Partial<Parameters<typeof ScannerHints>[0]>) =>
      render(<ScannerHints phase="challenge" guidance="move" mode={mode('LOOK_UP')} mirrored accessories={[]} {...props} />, { wrapper: WithCatalogs }).container;
    expect(hints({ phase: 'blocked', accessories: ['GLASSES'] }).querySelector('.accessory-alert')).toHaveTextContent('Lentes');
    expect(hints({}).querySelector('.tilt-cue')).not.toBeNull();
    expect(hints({ guidance: 'hold_still' })).toBeEmptyDOMElement();
    expect(hints({ guidance: 'ready' })).toBeEmptyDOMElement();
    expect(hints({ phase: 'recenter', mode: null })).toBeEmptyDOMElement();
  });
});
