import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Overlay } from './Overlay';

/** `fireEvent` devuelve false si el manejador canceló la acción por omisión (el foco no avanza solo). */
const tab = (target: Element, shiftKey = false) => fireEvent.keyDown(target, { key: 'Tab', shiftKey });

describe('Overlay: foco', () => {
  it('sin controles enfocables, Tab no se intercepta', () => {
    render(<Overlay>Solo texto</Overlay>);
    expect(tab(screen.getByRole('dialog'))).toBe(true);
  });

  it('Tab y Shift+Tab avanzan normal entre controles intermedios; solo se dan la vuelta en los extremos', () => {
    render(
      <Overlay>
        <button type="button">uno</button>
        <button type="button">dos</button>
        <button type="button">tres</button>
      </Overlay>,
    );
    const [first, middle, last] = screen.getAllByRole('button');
    first.focus();
    expect(tab(first)).toBe(true);
    middle.focus();
    expect(tab(middle, true)).toBe(true);
    last.focus();
    expect(tab(last)).toBe(false);
    expect(first).toHaveFocus();
  });

  it('con el foco previo en un elemento que no es HTML (SVG) abre y cierra sin devolverle el foco', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    document.body.append(svg);
    svg.focus();
    const { unmount } = render(<Overlay>Aviso</Overlay>);
    expect(screen.getByRole('dialog')).toHaveFocus();
    unmount();
    expect(svg).not.toHaveFocus();
    svg.remove();
  });
});
