import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { CompanyVerification } from '../../types';
import type { GeoPoint } from '../../utils/address';
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

/** Responde el listado; `emptyWhen` deja una página vacía (p. ej. al filtrar). */
function serve({ rows = [located, unlocated], emptyWhen }: { rows?: CompanyVerification[]; emptyWhen?: (url: string) => boolean } = {}) {
  return mockFetch((call: MockCall) => {
    const items = emptyWhen?.(call.url) ? [] : rows;
    return apiOk({ items, total: items.length, page: 1, size: 10 });
  });
}
const lastList = (calls: MockCall[]) => calls.filter((c) => c.url.includes('/verifications')).at(-1)?.url ?? '';

afterEach(() => vi.clearAllMocks());

describe('VerificationsPage (empresa: verificaciones con el mapa)', () => {
  it('lista cada verificación con su resultado, método y lugar; una sin ubicación lo dice y no se puede ver en el mapa', async () => {
    serve();
    renderWithProviders(<VerificationsPage />);
    expect(screen.getByRole('heading', { name: 'Verificaciones' })).toBeInTheDocument();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver en el mapa/ })).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('sin punto');
  });

  it('elegir una fila con ubicación la centra en el mapa y la resalta', async () => {
    serve();
    renderWithProviders(<VerificationsPage />);
    const show = await screen.findByRole('button', { name: /Ver en el mapa/ });
    await userEvent.click(show);
    expect(screen.getByTestId('map')).toHaveTextContent('29.1,-110.9');
    expect(show).toHaveAttribute('aria-pressed', 'true');
    expect(show.closest('tr')).toHaveClass('is-selected');
  });

  it('filtrar por resultado vuelve a pedir el listado con success', async () => {
    const { calls } = serve();
    renderWithProviders(<VerificationsPage />);
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('tab', { name: 'Fallidas' }));
    await waitFor(() => expect(lastList(calls)).toContain('success=false'));
    await userEvent.click(screen.getByRole('tab', { name: 'Exitosas' }));
    await waitFor(() => expect(lastList(calls)).toContain('success=true'));
  });

  it('filtrar por fecha agrega el rango a la consulta', async () => {
    const { calls } = serve();
    renderWithProviders(<VerificationsPage />);
    await screen.findByText('Ana Ruiz');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01/10/2026' } });
    await waitFor(() => expect(lastList(calls)).toContain('start=2026-10-01'));
  });

  it('sin verificaciones: estado vacío con su descripción', async () => {
    serve({ rows: [] });
    renderWithProviders(<VerificationsPage />);
    expect(await screen.findByText('Sin verificaciones')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás dónde se hizo cada verificación.')).toBeInTheDocument();
  });

  it('con un filtro y sin coincidencias: "Sin resultados"', async () => {
    serve({ emptyWhen: (url) => url.includes('success=false') });
    renderWithProviders(<VerificationsPage />);
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('tab', { name: 'Fallidas' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otro filtro o rango de fechas.')).toBeInTheDocument();
  });

  it('una falla al cargar se avisa en popup con "Reintentar"', async () => {
    mockFetch(() => apiFail(503, 'SERVICE_UNAVAILABLE', 'Servidor ocupado'));
    renderWithProviders(<VerificationsPage />);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las verificaciones' })).toBeInTheDocument();
  });

  it('en inglés: título, filtros y vacío', async () => {
    await setLocale('en-US');
    serve({ rows: [] });
    renderWithProviders(<VerificationsPage />);
    expect(screen.getByRole('heading', { name: 'Verifications' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Failed' })).toBeInTheDocument();
    expect(screen.getByText('Pick a verification with a location to see it on the map.')).toBeInTheDocument();
    expect(await screen.findByText('No verifications')).toBeInTheDocument();
  });
});
