import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../utils/numbers';
import { ColumnChart } from './ColumnChart';

interface Point {
  at: string;
  p50: number;
  p95: number;
}

const points: Point[] = [
  { at: '10:00', p50: 100, p95: 400 },
  { at: '10:15', p50: 200, p95: 800 },
];
const series = [
  { key: 'p50', label: 'p50', value: (point: Point) => point.p50 },
  { key: 'p95', label: 'p95', value: (point: Point) => point.p95 },
];
const category = { header: 'Intervalo', one: 'intervalo', other: 'intervalos' };

function chart(items: Point[]) {
  return render(<ColumnChart variant="lines" title="Tiempos" items={items} itemKey={(p) => p.at} itemLabel={(p) => p.at} series={series} format={formatDuration} category={category} />);
}

describe('ColumnChart con líneas (tendencias)', () => {
  it('una línea por serie sobre las columnas, un punto por categoría y el resumen dice dónde termina cada una (no suma)', () => {
    const { container } = chart(points);
    expect(screen.getByRole('img', { name: 'Tiempos. 2 intervalos. Al final: p50: 200 ms; p95: 800 ms. Máximo: 800 ms.' })).toBeInTheDocument();
    const lines = [...container.querySelectorAll('polyline')];
    expect(lines.map((line) => [line.getAttribute('class'), line.getAttribute('points')])).toEqual([
      ['chart-stroke-1', '0.5,87.5 1.5,75'],
      ['chart-stroke-2', '0.5,50 1.5,0'],
    ]);
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 2 100');
    expect(container.querySelectorAll('.column-chart__dot')).toHaveLength(4);
    expect(container.querySelector('.column-chart__bar')).toBeNull();
    expect(container.querySelector('figure')).toHaveClass('column-chart--lines');
    // La tabla para lectores de pantalla tiene todos los valores.
    expect(screen.getByRole('table', { name: 'Tiempos' })).toHaveTextContent('10:15200 ms800 ms');
  });

  it('sin puntos no hay líneas que terminen en algo: el resumen dice cero', () => {
    chart([]);
    expect(screen.getByRole('img', { name: 'Tiempos. 0 intervalos. Al final: p50: 0 ms; p95: 0 ms. Máximo: 0 ms.' })).toBeInTheDocument();
  });
});
