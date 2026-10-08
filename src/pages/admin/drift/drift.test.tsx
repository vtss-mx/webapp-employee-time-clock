import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { CompanyDriftRow, DriftRow, DriftSummary } from '../../../types/drift';
import { DriftPage } from './DriftPage';

const summary: DriftSummary = {
  window_days: 7,
  psi_alert: 0.2,
  tail_drop_alert: 0.15,
  min_samples: 200,
  quick_review_seconds: 30,
  quick_approval_ratio: 0.8,
  weeks: ['2026-09-28', '2026-09-21'],
  latest_week: '2026-09-28',
  alerts: 1,
  insufficient: 3,
  companies_alerted: 1,
  platforms: ['IOS_SAFARI', 'ANDROID_CHROME', 'DESKTOP', 'OTHER'],
  versions: [{ id: 1, component: 'risk_engine', version: '1.2.0', noted_at: '2026-09-29T03:00:00Z' }, { id: 2, component: 'desconocido', version: 'x', noted_at: '2026-09-29T03:00:00Z' }],
  computed_at: '2026-10-05T03:00:00Z',
};
const empty: DriftSummary = { ...summary, weeks: [], latest_week: null, alerts: 0, insufficient: 0, companies_alerted: 0, versions: [], computed_at: null };
const yaw: DriftRow = {
  id: 1,
  week_start: '2026-09-28',
  signal: 'LIVENESS_YAW',
  signal_name: 'Giro mínimo de la cabeza',
  platform: 'IOS_SAFARI',
  samples: 420,
  baseline_samples: 390,
  median: 0.21,
  baseline_median: 0.3,
  tail: 0.15,
  baseline_tail: 0.26,
  tail_percentile: 10,
  tail_change: -0.42,
  psi: 0.31,
  status: 'ALERT',
  upper: false,
  computed_at: '2026-10-05T03:00:00Z',
};
const moire: DriftRow = { ...yaw, id: 2, signal: 'MOIRE', signal_name: 'Moiré máximo', platform: 'DESKTOP', samples: 12, baseline_samples: 0, median: null, baseline_median: null, tail: null, baseline_tail: null, tail_percentile: 90, tail_change: null, psi: null, status: 'INSUFFICIENT', upper: true };
const acme: CompanyDriftRow = { id: 1, week_start: '2026-09-28', company_id: 1, company_name: 'Acme', attempts: 1200, fraud_cases: 3, case_rate: 0.0025, reviews: 12, approved: 11, quick_approvals: 10, quick_rate: 0.8333, status: 'ALERT', computed_at: '2026-10-05T03:00:00Z' };

interface ServerOptions {
  summaryResponse?: Response;
  rows?: DriftRow[];
  /** La respuesta de la lista de señales cuando no es la página de `rows` (una falla). */
  rowsResponse?: Response;
  computeResponse?: Response;
  companies?: CompanyDriftRow[];
}

function server({ summaryResponse = apiOk(summary), rows = [yaw, moire], rowsResponse, computeResponse, companies = [acme] }: ServerOptions = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/admin/drift/compute')) return computeResponse ?? apiOk({ ...summary, alerts: 0 }, { message: 'Deriva calculada (33 filas)' });
    if (call.url.endsWith('/admin/drift/summary')) return summaryResponse;
    if (call.url.includes('/admin/drift/companies')) return apiOk({ items: companies, total: companies.length, page: 1, size: 10, week_start: '2026-09-28' });
    return rowsResponse ?? apiOk({ items: rows, total: rows.length, page: 1, size: 10, week_start: '2026-09-28' });
  });
}

function renderPage(route = '/admin/drift') {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/drift" element={<DriftPage />} />
    </Routes>,
    { route },
  );
}

const signalRequests = (calls: MockCall[]) => calls.filter((c) => /\/admin\/drift(\?|$)/.test(c.url));

describe('DriftPage (deriva de señales, ADMIN)', () => {
  it('indicadores, la regla y la tabla de señales con sus medidas frente a la semana anterior', async () => {
    const { calls } = server();
    const { container } = renderPage();
    expect(await screen.findByText('Giro mínimo de la cabeza')).toBeInTheDocument();
    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Señales con deriva', 'Sin datos suficientes', 'Empresas con alerta', 'Semanas calculadas']);
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[3]).toHaveTextContent('2'));
    expect(screen.getByText(/Alerta con un PSI mayor que 0.2 o una cola que cae más de 15 %/)).toHaveTextContent('Ventanas de 7 días.');
    const row = screen.getByText('Giro mínimo de la cabeza').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('iPhone y iPad (Safari)');
    expect(row).toHaveTextContent('420antes: 390');
    expect(row).toHaveTextContent('0.21antes: 0.3');
    expect(row).toHaveTextContent('0.15 −42 %10 % más bajo · antes: 0.26');
    expect(row).toHaveTextContent('0.31');
    expect(within(row).getByText('Deriva')).toHaveClass('badge--danger');
    const second = screen.getByText('Moiré máximo').closest('tr') as HTMLElement;
    expect(second).toHaveTextContent('10 % más alto');
    expect(within(second).getByText('Pocos datos')).toHaveClass('badge--muted');
    expect(second).toHaveTextContent('—');
    // La lista se pide sin semana (el servidor da la más reciente) y, con el resumen, por la semana más reciente.
    expect(signalRequests(calls)[0].url).toBe('/api/admin/drift?page=1&size=10');
    await waitFor(() => expect(signalRequests(calls).map((c) => c.url)).toContain('/api/admin/drift?page=1&size=10&week=2026-09-28'));
  });

  it('los filtros de semana, plataforma y estado vuelven a pedir la lista', async () => {
    const { calls } = server();
    renderPage();
    await screen.findByText('Giro mínimo de la cabeza');
    await userEvent.click(screen.getByRole('button', { name: /^Plataforma/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Escritorio' }));
    await waitFor(() => expect(signalRequests(calls).at(-1)?.url).toContain('platform=DESKTOP'));
    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Deriva' }));
    await waitFor(() => expect(signalRequests(calls).at(-1)?.url).toContain('status=ALERT'));
    await userEvent.click(screen.getByRole('button', { name: /^Semana/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Semana del .*21/ }));
    await waitFor(() => expect(signalRequests(calls).at(-1)?.url).toContain('week=2026-09-21'));
  });

  it('con filtros y sin coincidencias, el vacío lo dice; sin semanas calculadas, explica que el mantenimiento las calcula', async () => {
    server({ rows: [] });
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Sin semanas calculadas');
    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Estable' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Prueba con otra semana, plataforma o estado.');
  });

  it('la pestaña Empresas: casos por intento, aprobadas sin mirar y búsqueda; Versiones: la bitácora del motor', async () => {
    const { calls } = server();
    renderPage('/admin/drift?tab=companies');
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText(/aprobadas en menos de 30 s/)).toBeInTheDocument();
    const row = screen.getByText('Acme').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('1,200');
    expect(row).toHaveTextContent('0.3 %'); // 3 casos en 1 200 intentos
    expect(row).toHaveTextContent('83.3 %10 de 11 aprobadas');
    expect(within(row).getByText('Revisar')).toHaveClass('badge--danger');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Empresa' }), 'ac');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=ac'));
    expect(screen.queryByRole('button', { name: /^Plataforma/ })).toBeNull(); // solo las señales filtran por plataforma

    await userEvent.click(screen.getByRole('tab', { name: 'Versiones' }));
    const versions = await screen.findByRole('tabpanel');
    expect(versions).toHaveTextContent('Motor de riesgo');
    expect(versions).toHaveTextContent('1.2.0');
    expect(versions).toHaveTextContent('desconocido'); // un componente nuevo del servidor se muestra tal cual
  });

  it('sin versiones anotadas, su vacío; «Calcular ahora» pregunta, calcula, avisa con el mensaje del servidor y refresca', async () => {
    const { calls } = server({ summaryResponse: apiOk(empty), rows: [] });
    const { container } = renderPage('/admin/drift?tab=versions');
    expect(await screen.findByText('Sin cambios de versión')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[0]).toHaveTextContent('0'));
    await userEvent.click(screen.getByRole('button', { name: 'Calcular ahora' }));
    const ask = await screen.findByRole('dialog', { name: '¿Calcular ahora la última semana completa?' });
    expect(ask).toHaveTextContent('Solo mide y avisa: no cambia ningún umbral ni ninguna política.');
    await userEvent.click(within(ask).getByRole('button', { name: 'Calcular' }));
    expect(await screen.findByRole('dialog', { name: 'Deriva calculada' })).toHaveTextContent('Deriva calculada (33 filas)');
    expect(calls.some((c) => c.url.endsWith('/admin/drift/compute') && c.init.method === 'POST')).toBe(true);
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[3]).toHaveTextContent('2')); // el resumen nuevo
  });

  it('si la lista de señales no carga, el popup lo explica con «Reintentar» (el resumen sigue); si calcular falla, su popup', async () => {
    server({ rowsResponse: apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto'), computeResponse: apiFail(409, 'DRIFT_DISABLED', 'El monitoreo de deriva está apagado') });
    const { container } = renderPage();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la deriva' })).toHaveTextContent('El servidor respondió con un conflicto');
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[3]).toHaveTextContent('2'));
    await userEvent.click(within(screen.getByRole('alertdialog')).getAllByRole('button', { name: 'Cerrar' })[0]);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Calcular ahora' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Calcular' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo calcular la deriva' })).toHaveTextContent('El monitoreo de deriva está apagado');
  });

  it('si el resumen no carga, el popup lo explica y queda «Reintentar»; calcular no se ofrece sin datos', async () => {
    server({ summaryResponse: apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto') });
    renderPage();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la deriva' })).toHaveTextContent('El servidor respondió con un conflicto');
    expect(screen.getByRole('button', { name: 'Calcular ahora' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });
});
