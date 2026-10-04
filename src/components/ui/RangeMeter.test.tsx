import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RangeMeter } from './RangeMeter';

const ratio = () => screen.getByRole('meter').style.getPropertyValue('--meter');

describe('RangeMeter: medidor propio de un valor en un rango', () => {
  it('ubica el valor entre los extremos y lo anuncia a lectores de pantalla', () => {
    const { container } = render(<RangeMeter value={0.25} min={0} max={1} label="Giro" />);
    const meter = screen.getByRole('meter', { name: 'Giro' });
    expect(meter).toHaveAttribute('aria-valuenow', '0.25');
    expect(meter).toHaveAttribute('aria-valuetext', '0.25');
    expect(ratio()).toBe('0.25');
    expect(container.firstChild).toHaveClass('range-meter', 'range-meter--primary');
    expect(container.querySelector('.range-meter__scale')).toHaveTextContent('Mínimo 0Tope 1');
  });

  it('se personaliza: formato, textos de los extremos, tono y clase', () => {
    const { container } = render(
      <RangeMeter value={1.3} min={1.25} max={1.45} label="Acercarse" format={(v) => `×${v}`} labels={{ min: 'Piso', max: 'Máximo' }} tone="success" className="extra" />,
    );
    expect(container.firstChild).toHaveClass('range-meter--success', 'extra');
    expect(container.querySelector('.range-meter__scale')).toHaveTextContent('Piso ×1.25Máximo ×1.45');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '×1.3');
  });

  it('fuera del rango queda en su extremo; un rango sin amplitud se muestra lleno', () => {
    const { rerender } = render(<RangeMeter value={-1} min={0} max={1} label="x" />);
    expect(ratio()).toBe('0');
    rerender(<RangeMeter value={5} min={0} max={1} label="x" tone="warning" />);
    expect(ratio()).toBe('1');
    rerender(<RangeMeter value={0.35} min={0.35} max={0.35} label="x" />);
    expect(ratio()).toBe('1');
  });
});
