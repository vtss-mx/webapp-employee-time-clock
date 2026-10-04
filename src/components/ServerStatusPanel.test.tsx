import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import { ServerStatusPanel } from './ServerStatusPanel';

const status = {
  status: 'degraded',
  components: { database: { status: 'ok' }, cache_redis: { status: 'timeout', error: 'Sin respuesta en 2 s' } },
  admission: {
    limit: 40,
    bounds: [8, 200],
    in_flight: 3,
    waiting: 0,
    admitted: 900,
    shed: 0,
    latency_ratio: null,
    top_demand: [
      { api: 'POST checkpoint/identify/face', tier: 'CRITICAL', recent_requests: 1500, latency_ms: 210.5, shed: 3 },
      { api: 'GET reports', tier: 'BATCH', recent_requests: 12, latency_ms: null, shed: 0 },
    ],
  },
};

describe('ServerStatusPanel', () => {
  it('componentes y prioridades que la app aún no conoce se muestran con su nombre técnico', async () => {
    mockFetch(apiOk(status));
    renderWithProviders(<ServerStatusPanel />);
    expect(await screen.findByText('Funciones limitadas')).toBeInTheDocument();
    expect(screen.getByText('Base de datos: disponible')).toBeInTheDocument();
    expect(screen.getByText('cache_redis: timeout')).toBeInTheDocument();
    expect(screen.getByText('Sin respuesta en 2 s')).toBeInTheDocument();
    expect(screen.getByText('prioridad crítica · 1,500 peticiones recientes · 210.5 ms · 3 descartadas')).toBeInTheDocument();
    expect(screen.getByText('prioridad BATCH · 12 peticiones recientes')).toBeInTheDocument(); // sin latencia ni descartes
    expect(screen.getByText(/entre 8 y 200/)).toBeInTheDocument();
  });

  it('si el estado no se pudo cargar: límites desconocidos y "Reintentar"', async () => {
    let attempts = 0;
    mockFetch(() => (++attempts === 1 ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(status)));
    renderWithProviders(<ServerStatusPanel />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el estado del servidor' });
    expect(screen.getByText(/entre … y …/)).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Funciones limitadas')).toBeInTheDocument();
  });
});
