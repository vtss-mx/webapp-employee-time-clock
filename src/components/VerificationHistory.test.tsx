import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import type { VerificationLog } from '../types';
import { VerificationHistory } from './VerificationHistory';

const log = (id: number, extra: Partial<VerificationLog> = {}): VerificationLog => ({
  id,
  method: 'QR',
  success: true,
  score: null,
  reason: null,
  ip_address: null,
  created_at: '2026-10-01T09:00:00Z',
  ...extra,
});

describe('VerificationHistory (bitácora paginada del empleado)', () => {
  it('pinta cada intento con los nombres del catálogo y pagina contra el backend', async () => {
    const { calls } = mockFetch((call) => {
      const page = Number(new URL(call.url, 'http://x').searchParams.get('page'));
      return page === 1
        ? apiOk({ items: [log(30, { method: 'FACE', score: 0.97 }), log(29, { success: false, reason: 'NO_MATCH' })], total: 12, page: 1, size: 10 })
        : apiOk({ items: [log(2)], total: 12, page: 2, size: 10 });
    });
    renderWithProviders(<VerificationHistory employeeId={7} />);
    expect(await screen.findByText(/Confianza/)).toBeInTheDocument();
    expect(screen.getByText('Rostro')).toBeInTheDocument();
    expect(screen.getByText(/Rostro no coincide/)).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/employees/7/verifications?page=1&size=10');

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(nav).toHaveClass('pager--compact');
    expect(nav.querySelector('.pager__range')).toHaveTextContent('Mostrando 1–10 de 12 intentos');
    await userEvent.click(within(nav).getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(nav.querySelector('.pager__range')).toHaveTextContent('Mostrando 11–12 de 12 intentos'));
    expect(calls.at(-1)?.url).toBe('/api/employees/7/verifications?page=2&size=10');
  });

  it('sin intentos lo dice; si falla ofrece reintentar', async () => {
    mockFetch(apiOk({ items: [], total: 0, page: 1, size: 10 }));
    const { unmount } = renderWithProviders(<VerificationHistory employeeId={7} />);
    expect(await screen.findByText('No hay verificaciones registradas')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
    unmount();

    mockFetch(apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado'), apiOk({ items: [log(1)], total: 1, page: 1, size: 10 }));
    renderWithProviders(<VerificationHistory employeeId={8} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Exitosa', { exact: false })).toBeInTheDocument();
  });
});
