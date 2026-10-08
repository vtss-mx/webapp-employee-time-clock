import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WithCatalogs } from '../test/render';
import { config } from '../utils/config';
import type { ActionMode } from '../utils/facePose';
import { ActionCue, ScannerHints } from './LivenessCues';

const mode = (action: ActionMode['action'], minimum = 0.2): ActionMode => ({ kind: 'action', action, minimum, baseline: null });

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

  it('sobre el rostro solo la señal del movimiento mientras falta hacerlo; en un bloqueo, nada (ninguna insignia)', () => {
    const hints = (props: Partial<Parameters<typeof ScannerHints>[0]>) =>
      render(<ScannerHints phase="challenge" guidance="move" mode={mode('LOOK_UP')} mirrored {...props} />, { wrapper: WithCatalogs }).container;
    expect(hints({ phase: 'blocked' })).toBeEmptyDOMElement();
    expect(hints({}).querySelector('.ring-cue--up')).not.toBeNull();
    expect(hints({ guidance: 'hold_still' })).toBeEmptyDOMElement();
    expect(hints({ guidance: 'ready' })).toBeEmptyDOMElement();
    expect(hints({ phase: 'recenter', mode: null })).toBeEmptyDOMElement();
  });
});
