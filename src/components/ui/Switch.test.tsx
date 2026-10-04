import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('mientras se guarda queda ocupado (aria-busy) y no se puede volver a pulsar', () => {
    render(<Switch checked label="Destello de colores" busy onChange={vi.fn()} />);
    const control = screen.getByRole('switch', { name: 'Destello de colores' });
    expect(control).toHaveAttribute('aria-busy', 'true');
    expect(control).toHaveClass('switch', 'is-busy');
    expect(control).toBeDisabled();
  });
});
