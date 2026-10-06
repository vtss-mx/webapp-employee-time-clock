import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRing, ringValue } from './ProgressRing';

describe('ProgressRing: anillo de avance continuo', () => {
  it('el avance se acota a 0..1 (un valor fuera de rango o no numérico nunca da un arco inválido)', () => {
    expect([0, 0.25, 1, 1.4, -0.2, Number.NaN, Number.POSITIVE_INFINITY].map(ringValue)).toEqual([0, 0.25, 1, 1, 0, 0, 0]);
  });

  it('el arco descubre los grados del avance y su punta gira con él (solo estilos: el CSS los anima)', () => {
    const { container } = render(<ProgressRing value={0.25} thickness={2} label="Avance al 25 %" active />);
    const ring = screen.getByRole('img', { name: 'Avance al 25 %' });
    expect(ring).toHaveAttribute('data-value', '25');
    expect(ring).toHaveClass('progress-ring', 'progress-ring--started', 'progress-ring--active');
    const arc = container.querySelector<SVGCircleElement>('.progress-ring__arc');
    expect(arc?.style.strokeDashoffset).toBe('270'); // 360° − 90°
    expect(arc).toHaveAttribute('r', '48');
    expect(arc).toHaveAttribute('stroke-width', '2');
    expect(container.querySelector<SVGGElement>('.progress-ring__head')?.style.transform).toBe('rotate(90deg)');
    expect(container.querySelector('.progress-ring__spark')).toHaveAttribute('cx', '98');
    expect(container.querySelector('.progress-ring__track')).toHaveAttribute('r', '48');
    // El degradado se nombra con un id propio de cada anillo (dos anillos no se pisan).
    const gradient = container.querySelector('linearGradient')?.id ?? '';
    expect(gradient).toMatch(/^ring-[\w-]+-fill$/);
    expect(arc).toHaveAttribute('stroke', `url(#${gradient})`);
  });

  it('sin texto es decorativo; en cero aún no empieza (la punta redonda no asoma) y por omisión es fino', () => {
    const { container } = render(<ProgressRing value={0} className="mi-anillo" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).toHaveClass('progress-ring', 'mi-anillo');
    expect(svg).not.toHaveClass('progress-ring--started');
    expect(svg).not.toHaveClass('progress-ring--active');
    expect(container.querySelector('.progress-ring__arc')).toHaveAttribute('stroke-width', '1.2');
    expect(container.querySelector<SVGCircleElement>('.progress-ring__arc')?.style.strokeDashoffset).toBe('360');
  });
});
