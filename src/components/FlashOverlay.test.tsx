import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlashOverlay } from './FlashOverlay';
import { config } from '../utils/config';

/*
 * Capa de color del destello: no dibuja nada sin color (el camino por omisión jamás pinta), pinta el color atenuado por
 * la luminancia cuando lo hay y es decorativa (aria-hidden), sin transición.
 */

describe('FlashOverlay', () => {
  it('sin color no renderiza nada (por omisión, la pantalla no se pinta)', () => {
    const { container } = render(<FlashOverlay color={null} />);
    expect(container.querySelector('.flash')).toBeNull();
  });

  it('pinta el color #RRGGBB atenuado por la luminancia y es decorativo', () => {
    const { container } = render(<FlashOverlay color="#FF0000" />);
    const overlay = container.querySelector('.flash') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute('aria-hidden');
    const channel = Math.round(255 * config.faceFlashLuminance);
    expect(overlay.style.getPropertyValue('--flash-color')).toBe(`rgb(${channel}, 0, 0)`);
  });

  it('un color que no es #RRGGBB se usa tal cual (respaldo defensivo)', () => {
    const { container } = render(<FlashOverlay color="red" />);
    expect((container.querySelector('.flash') as HTMLElement).style.getPropertyValue('--flash-color')).toBe('red');
  });
});
