import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { sampleVerificationDetail, sampleVerificationSummary } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { CompanyVerification } from '../../types';
import type { GeoPoint } from '../../utils/address';
import { CompanyVerificationDetailPage } from '../verifications/VerificationDetailPages';
import { VerificationsPage } from './VerificationsPage';

// El mapa de Google se prueba aparte (VerificationMap.test); aquí basta ver qué punto recibe.
vi.mock('../../components/location/VerificationMap', () => ({
  VerificationMap: ({ point }: { point: GeoPoint | null }) => <div data-testid="map">{point ? `${point.lat},${point.lng}` : 'sin punto'}</div>,
}));

const located: CompanyVerification = {
  id: 10,
  created_at: '2026-10-07T10:00:00Z',
  method: 'FACE',
  success: true,
  reason: null,
  confidence: 0.99,
  employee_id: 7,
  employee_number: 'EMP-7',
  employee_name: 'Ana Ruiz',
  avatar: null,
  latitude: 29.1,
  longitude: -110.9,
  location_accuracy_m: 12,
};
const unlocated: CompanyVerification = {
  id: 11,
  created_at: '2026-10-07T09:00:00Z',
  method: 'API_FACE',
  success: false,
  reason: 'NO_MATCH',
  confidence: null,
  employee_id: null,
  employee_number: null,
  employee_name: null,
  avatar: null,
  latitude: null,
  longitude: null,
  location_accuracy_m: null,
};
/** El periodo y el tope del conteo los envía SIEMPRE el servidor (regla 25): el guard de la app los exige. */
const PERIOD = { since: sampleVerificationSummary.since, until: sampleVerificationSummary.until, count_cap: 10_000 };

/** Responde el resumen y el listado; `emptyWhen` deja una página vacía (p. ej. al filtrar). */
function serve({ rows = [located, unlocated], emptyWhen }: { rows?: CompanyVerification[]; emptyWhen?: (url: string) => boolean } = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/verifications/summary')) return apiOk(sampleVerificationSummary);
    const items = emptyWhen?.(call.url) ? [] : rows;
    return apiOk({ items, total: items.length, page: 1, size: 10, ...PERIOD });
  });
}
const lastList = (calls: MockCall[]) => calls.filter((c) => /\/api\/verifications(\?|$)/.test(c.url)).at(-1)?.url ?? '';

/** La pantalla con su ruta hija: así «abrir una fila» es la navegación de verdad, sin simular el router. */
function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/company/verifications" element={<VerificationsPage />} />
      <Route path="/company/verifications/:id" element={<CompanyVerificationDetailPage />} />
    </Routes>,
    { route: '/company/verifications' },
  );
}

afterEach(() => vi.clearAllMocks());

describe('VerificationsPage (empresa: historial con el mapa, el resumen y el detalle)', () => {
  it('lista cada verificación con su resultado, método y lugar; una sin ubicación lo dice y no se puede ver en el mapa', async () => {
    serve();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Verificaciones' })).toBeInTheDocument();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver en el mapa/ })).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('sin punto');
  });

  it('el resumen del periodo se dibuja con los conteos que agrupó el servidor', async () => {
    serve();
    renderPage();
    expect(await screen.findByText('Verificaciones', { selector: '.kpi__label' })).toBeInTheDocument();
    expect(screen.getByText('Motivos de rechazo')).toBeInTheDocument();
    expect(screen.getByText(/Rostro no coincide: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Periodo/)).toBeInTheDocument();
  });

  it('elegir una fila con ubicación la centra en el mapa sin abrir su detalle', async () => {
    serve();
    renderPage();
    const show = await screen.findByRole('button', { name: /Ver en el mapa/ });
    await userEvent.click(show);
    expect(screen.getByTestId('map')).toHaveTextContent('29.1,-110.9');
    expect(show).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: /Verificación 10/ })).not.toBeInTheDocument();
  });

  it('abrir una fila lleva a su detalle', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/verifications/summary')) return apiOk(sampleVerificationSummary);
      if (call.url.includes('/verifications/10')) return apiOk({ ...sampleVerificationDetail, id: 10 });
      return apiOk({ items: [located], total: 1, page: 1, size: 10, ...PERIOD });
    });
    renderPage();
    await userEvent.click(await screen.findByText('Ana Ruiz'));
    expect(await screen.findByRole('heading', { name: 'Verificación 10' })).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/verifications/10'))).toBe(true);
  });

  it('filtrar por resultado, método, motivo, riesgo y ubicación vuelve a pedir el listado', async () => {
    const { calls } = serve();
    renderPage();
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('tab', { name: 'Fallidas' }));
    await waitFor(() => expect(lastList(calls)).toContain('success=false'));
    await userEvent.click(screen.getByRole('button', { name: /^Método/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Rostro' }));
    await waitFor(() => expect(lastList(calls)).toContain('method=FACE'));
    await userEvent.click(screen.getByRole('button', { name: /^Nivel de riesgo/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Alto' }));
    await waitFor(() => expect(lastList(calls)).toContain('risk_tier=HIGH'));
    await userEvent.click(screen.getByRole('button', { name: /^Lugar/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Sin ubicación' }));
    await waitFor(() => expect(lastList(calls)).toContain('located=false'));
  });

  it('filtrar por fecha agrega el rango a la consulta', async () => {
    const { calls } = serve();
    renderPage();
    await screen.findByText('Ana Ruiz');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01/10/2026' } });
    await waitFor(() => expect(lastList(calls)).toContain('start=2026-10-01'));
  });

  it('sin verificaciones: estado vacío con su descripción', async () => {
    serve({ rows: [] });
    renderPage();
    expect(await screen.findByText('Sin verificaciones')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás dónde se hizo cada verificación.')).toBeInTheDocument();
  });

  it('con un filtro y sin coincidencias: "Sin resultados"', async () => {
    serve({ emptyWhen: (url) => url.includes('success=false') });
    renderPage();
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('tab', { name: 'Fallidas' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otro filtro o rango de fechas.')).toBeInTheDocument();
  });

  it('una falla al cargar la lista se avisa en su popup', async () => {
    mockFetch((call: MockCall) => (call.url.includes('/verifications/summary') ? apiOk(sampleVerificationSummary) : apiFail(503, 'SERVICE_UNAVAILABLE', 'Servidor ocupado')));
    renderPage();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las verificaciones' })).toBeInTheDocument();
  });

  it('si solo falla el resumen, la lista se ve y el resumen ofrece reintentar', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/verifications/summary')) return apiFail(503, 'SERVICE_UNAVAILABLE', 'Servidor ocupado');
      return apiOk({ items: [located], total: 1, page: 1, size: 10, ...PERIOD });
    });
    renderPage();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    await userEvent.click(retry);
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/verifications/summary')).length).toBeGreaterThan(1));
  });

  it('en inglés: título, filtros y vacío', async () => {
    await setLocale('en-US');
    serve({ rows: [] });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Verifications' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Failed' })).toBeInTheDocument();
    expect(screen.getByText('Pick a verification with a location to see it on the map.')).toBeInTheDocument();
    expect(await screen.findByText('No verifications')).toBeInTheDocument();
  });
});
