import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, type CheckboxProps } from './Checkbox';

function Harness(props: Partial<CheckboxProps>) {
  const [checked, setChecked] = useState(false);
  return <Checkbox label="Excepción de prenda" checked={checked} onChange={setChecked} {...props} />;
}

describe('Checkbox', () => {
  it('casilla propia: la nativa queda oculta pero es la que se anuncia y se marca tocando toda la tarjeta', async () => {
    render(<Harness description="Por motivos religiosos o médicos" icon={<span>🛡</span>} aside={<span>1 km</span>} name="exempt" value="yes" />);
    const box = screen.getByRole('checkbox', { name: 'Excepción de prenda' });
    expect(box).toHaveClass('checkbox__input');
    expect(box).toHaveAccessibleDescription('Por motivos religiosos o médicos 1 km');
    expect(box).toHaveAttribute('name', 'exempt');
    expect(box).toHaveAttribute('value', 'yes');
    const card = box.closest('label') as HTMLElement;
    expect(card).toHaveClass('checkbox', 'checkbox--card', 'checkbox--md');
    expect(card.querySelector('.checkbox__icon')).toHaveTextContent('🛡');
    expect(card.querySelector('.checkbox__box svg')).toBeInTheDocument(); // palomita propia
    await userEvent.click(screen.getByText('Por motivos religiosos o médicos'));
    expect(box).toBeChecked();
    expect(card).toHaveClass('is-checked');
    box.focus();
    await userEvent.keyboard(' ');
    expect(box).not.toBeChecked();
  });

  it('compacta junto a su texto, con descripción externa, globo y marca propia', async () => {
    render(
      <>
        <Harness variant="inline" size="sm" title="No la uses en equipos compartidos" aria-describedby="hint" checkIcon={<span>✔</span>} className="extra" />
        <span id="hint">Mantén la sesión abierta</span>
      </>,
    );
    const box = screen.getByRole('checkbox', { name: 'Excepción de prenda' });
    expect(box).toHaveAccessibleDescription('Mantén la sesión abierta');
    const label = box.closest('label') as HTMLElement;
    expect(label).toHaveClass('checkbox--inline', 'checkbox--sm', 'extra');
    expect(label).toHaveAttribute('title', 'No la uses en equipos compartidos');
    expect(label.querySelector('.checkbox__box')).toHaveTextContent('✔');
    await userEvent.click(label);
    expect(box).toBeChecked();
  });

  it('sin descripción no se anuncia ninguna; deshabilitada no cambia', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Recordar" checked={false} onChange={onChange} disabled />);
    const box = screen.getByRole('checkbox', { name: 'Recordar' });
    expect(box).not.toHaveAttribute('aria-describedby');
    expect(box.closest('label')).toHaveClass('is-disabled');
    await userEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });
});
