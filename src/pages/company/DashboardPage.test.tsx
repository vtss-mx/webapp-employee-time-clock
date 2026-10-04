import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PendingEnrollmentsContext } from '../../hooks/usePendingEnrollments';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { DashboardPage } from './DashboardPage';

/** Resumen: total de empleados (sin filtro) y activos (`active=true`). */
function serve(totals: { all: number; active: number } | ((call: MockCall) => Response)) {
  return mockFetch((call) => {
    if (typeof totals === 'function') return totals(call);
    return apiOk({ items: [], total: call.url.includes('active=true') ? totals.active : totals.all, page: 1, size: 1 });
  });
}

/** Tablero con el contador de validaciones que le comparte el layout (null: aún no se sabe). */
function renderDashboard(pending: number | null) {
  return renderWithProviders(
    <PendingEnrollmentsContext.Provider value={pending}>
      <DashboardPage />
    </PendingEnrollmentsContext.Provider>,
  );
}

/** El indicador termina su conteo animado en el valor del servidor. */
const expectKpi = (label: string, value: string) =>
  waitFor(() => expect(screen.getByText(label).closest('.kpi')).toHaveTextContent(new RegExp(`^${label}${value}$`)));

afterEach(() => vi.useRealTimers());

describe('DashboardPage (COMPANY)', () => {
  it('resume empleados registrados, activos e inactivos y avisa de las validaciones pendientes', async () => {
    const { calls } = serve({ all: 12, active: 9 });
    renderDashboard(3);
    await expectKpi('Empleados registrados', '12');
    await expectKpi('Activos', '9');
    await expectKpi('Inactivos', '3');
    expect(screen.getByText('3 registros faciales esperan tu validación')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revisar ahora/ })).toHaveAttribute('href', '/company/validations');
    expect(screen.getByRole('link', { name: /Validaciones pendientes/ })).toHaveClass('kpi--accent');
    expect(calls.filter((c) => c.url.startsWith('/api/employees?')).map((c) => c.url)).toEqual(['/api/employees?size=1', '/api/employees?size=1&active=true']);
  });

  it('un solo registro pendiente se dice en singular', async () => {
    serve({ all: 1, active: 1 });
    renderDashboard(1);
    expect(await screen.findByText('1 registro facial espera tu validación')).toBeInTheDocument();
  });

  it('sin pendientes no hay aviso ni acento', async () => {
    serve({ all: 0, active: 0 });
    renderDashboard(0);
    await expectKpi('Empleados registrados', '0');
    expect(screen.queryByRole('link', { name: /Revisar ahora/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Validaciones pendientes/ })).not.toHaveClass('kpi--accent');
  });

  it('saluda según la hora del negocio (hora del Centro), no la del dispositivo', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    serve({ all: 0, active: 0 });
    for (const [utc, greeting] of [
      ['2026-10-01T15:00:00Z', 'Buenos días'], // 9:00 en Ciudad de México
      ['2026-10-01T21:00:00Z', 'Buenas tardes'], // 15:00
      ['2026-10-02T03:00:00Z', 'Buenas noches'], // 21:00
    ]) {
      vi.setSystemTime(new Date(utc));
      const { unmount } = renderDashboard(null);
      expect(screen.getByRole('heading', { name: greeting })).toBeInTheDocument();
      unmount();
    }
  });

  it('si el resumen no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    serve(() => {
      attempts += 1;
      return attempts <= 2 ? apiFail(403, 'FORBIDDEN', 'Sin acceso') : apiOk({ items: [], total: 5, page: 1, size: 1 });
    });
    renderDashboard(null);
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el resumen' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await expectKpi('Empleados registrados', '5');
    expect(screen.queryByRole('button', { name: 'Volver a cargar' })).toBeNull();
  });
});
