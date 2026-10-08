import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ResourceFallback } from './ResourceFallback';

describe('ResourceFallback', () => {
  it('sin error dibuja el esqueleto con las líneas pedidas (sin panel ni título)', () => {
    const { container } = renderWithProviders(<ResourceFallback error={null} retry={vi.fn()} lines={3} header={{ title: 'Caso 7' }} />);
    expect(screen.getByLabelText('Cargando')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.skeleton')).toHaveLength(3 + 3);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('con error dibuja la página con su encabezado, el regreso y «Reintentar»', async () => {
    const retry = vi.fn();
    renderWithProviders(<ResourceFallback error={new Error('x')} retry={retry} header={{ title: 'Caso 7', backTo: '/admin/fraud-cases', backLabel: 'Casos de fraude' }} />);
    expect(screen.getByRole('heading', { name: 'Caso 7' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Casos de fraude/ })).toHaveAttribute('href', '/admin/fraud-cases');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Cargando')).not.toBeInTheDocument();
  });
});
