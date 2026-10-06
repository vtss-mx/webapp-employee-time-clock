import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';

describe('Slider (deslizador propio)', () => {
  it('el input nativo transparente responde y se anuncia con su valor legible; los botones dan un paso', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={2} min={1} max={5} step={0.5} onChange={onChange} label="Acercamiento" format={(v) => `${v} ×`} showValue decrementLabel="Alejar" incrementLabel="Acercar" />,
    );
    const slider = screen.getByRole('slider', { name: 'Acercamiento' });
    expect(slider).toHaveAttribute('aria-valuetext', '2 ×');
    expect(container.querySelector('.slider')).toHaveStyle({ '--slider-ratio': '0.25' });
    expect(container.querySelector('.slider__value')).toHaveTextContent('2 ×');
    fireEvent.change(slider, { target: { value: '3.5' } });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    await userEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it('en sus límites el botón de ese lado se apaga; deshabilitado no responde; sin recorrido queda en cero', () => {
    const { rerender, container } = render(<Slider value={1} min={1} max={1} step={1} onChange={vi.fn()} label="Nivel" decrementLabel="Menos" incrementLabel="Más" />);
    expect(screen.getByRole('button', { name: 'Menos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Más' })).toBeDisabled();
    expect(container.querySelector('.slider')).toHaveStyle({ '--slider-ratio': '0' });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '1'); // formato por omisión
    rerender(<Slider value={3} min={1} max={5} step={1} onChange={vi.fn()} label="Nivel" disabled />);
    expect(screen.getByRole('slider')).toBeDisabled();
    expect(container.querySelector('.slider')).toHaveClass('is-disabled');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
