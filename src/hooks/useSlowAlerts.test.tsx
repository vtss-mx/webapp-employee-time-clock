import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { setLocale } from '../i18n/core';
import { settle } from '../test/companyPages';
import { apiOk, mockFetch } from '../test/http';
import type { SlowAlertSummary } from '../types/performance';
import { notifySlowAlertsChanged, useSlowAlerts } from './useSlowAlerts';

const latest = (opened_at: string, id = 7): SlowAlertSummary['latest'] => ({ id, route: 'GET /api/employees/{employee_id}', opened_at, last_ms: 1834 });
const summary = (open: number, last: SlowAlertSummary['latest']) => apiOk({ open, acknowledged: 0, latest: last });

function Badge({ enabled }: { enabled: boolean }) {
  const count = useSlowAlerts(enabled);
  return <p>abiertas: {count ?? 'sin dato'}</p>;
}

function renderBadge(enabled = true) {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <FeedbackProvider>
        <Routes>
          <Route path="/admin/dashboard" element={<Badge enabled={enabled} />} />
          <Route path="/admin/performance/alerts/:id" element={<p>Alerta abierta</p>} />
        </Routes>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

/** Otra consulta del resumen (como la periódica): la dispara el aviso de cambio. */
const poll = (seenOpenedAt?: string) => settle(() => notifySlowAlertsChanged(seenOpenedAt));

describe('alertas de peticiones lentas: contador del menú y aviso en vivo (una sola consulta)', () => {
  it('sin la pantalla no consulta nada', () => {
    const { calls } = mockFetch(summary(1, null));
    renderBadge(false);
    expect(screen.getByText('abiertas: sin dato')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('la primera respuesta solo fija la base; una alerta abierta después avisa una vez y "Ver alerta" la abre', async () => {
    const { calls } = mockFetch(
      summary(1, latest('2026-10-04T16:00:00Z')),
      summary(1, latest('2026-10-04T16:00:00Z')),
      summary(2, latest('2026-10-04T17:00:00Z', 9)),
      summary(2, latest('2026-10-04T17:00:00Z', 9)),
    );
    renderBadge();
    expect(await screen.findByText('abiertas: 1')).toBeInTheDocument();
    await poll();
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await poll();
    const popup = await screen.findByRole('alertdialog', { name: 'Petición lenta' });
    expect(screen.getByText('abiertas: 2')).toBeInTheDocument();
    expect(popup).toHaveTextContent('GET /api/employees/{employee_id} tardó 1.8 s, más del umbral.');
    expect(popup).toHaveTextContent('La alerta está en Rendimiento → Alertas.');
    // La misma apertura en la siguiente consulta no vuelve a avisar.
    await poll();
    await waitFor(() => expect(calls).toHaveLength(4));
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    await userEvent.click(within(popup).getByRole('button', { name: 'Ver alerta' }));
    expect(await screen.findByText('Alerta abierta')).toBeInTheDocument();
    expect(calls.every((call) => call.url === '/api/admin/performance/alerts/summary')).toBe(true);
  });

  it('sin alertas al abrir, la primera que aparece avisa; cerrar el aviso no navega', async () => {
    mockFetch(summary(0, null), summary(1, latest('2026-10-04T17:00:00Z')));
    renderBadge();
    expect(await screen.findByText('abiertas: 0')).toBeInTheDocument();
    await poll();
    const popup = await screen.findByRole('alertdialog', { name: 'Petición lenta' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' }).at(-1) as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('abiertas: 1')).toBeInTheDocument();
  });

  it('lo que la persona misma reabrió no se le anuncia; una fecha ilegible tampoco parece nueva', async () => {
    mockFetch(summary(0, null), summary(1, latest('2026-10-04T18:00:00Z')), summary(1, latest('fecha rota')));
    renderBadge();
    expect(await screen.findByText('abiertas: 0')).toBeInTheDocument();
    await poll('2026-10-04T18:00:00Z');
    expect(await screen.findByText('abiertas: 1')).toBeInTheDocument();
    await poll();
    await poll('no es una fecha');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('el aviso abierto cambia de idioma en caliente (en-US)', async () => {
    mockFetch(summary(0, null), summary(1, latest('2026-10-04T17:00:00Z')));
    renderBadge();
    expect(await screen.findByText('abiertas: 0')).toBeInTheDocument();
    await poll();
    expect(await screen.findByRole('alertdialog', { name: 'Petición lenta' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    const popup = await screen.findByRole('alertdialog', { name: 'Slow request' });
    expect(popup).toHaveTextContent('GET /api/employees/{employee_id} took 1.8 s, over the threshold.');
    expect(within(popup).getByRole('button', { name: 'View alert' })).toBeInTheDocument();
  });
});
