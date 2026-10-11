import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { AccessReviewAccount, AccessReviewSummary } from '../../../types/accessReview';
import { AccessReviewPage } from './AccessReviewPage';

const company: AccessReviewAccount = {
  id: 2,
  email: 'admin@acme.mx',
  role: 'COMPANY',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  company: { id: 1, name: 'Acme', active: true },
  last_login_at: '2026-10-05T15:00:00Z',
  days_since_login: 1,
  stale: false,
  locked: false,
  locked_until: null,
  mfa_required: true,
  mfa_satisfied: false,
  passkeys: 0,
  mfa_grace_until: '2026-10-20T00:00:00Z',
  open_sessions: 1,
  employments: 0,
};
/** Una cuenta bloqueada, inactiva y sin entrar nunca: el ADMIN la revisa primero. */
const stale: AccessReviewAccount = {
  ...company,
  id: 3,
  email: 'viejo@acme.mx',
  role: 'EMPLOYEE',
  company: null,
  active: false,
  last_login_at: null,
  days_since_login: null,
  stale: true,
  locked: true,
  locked_until: '2026-10-06T10:15:00Z',
  mfa_required: false,
  open_sessions: 0,
  employments: 2,
};
/** Una cuenta que ya cumple: ninguna marca que atender. */
const ok: AccessReviewAccount = { ...company, id: 4, email: 'root@acme.mx', role: 'ADMIN', company: null, mfa_satisfied: true, passkeys: 2, mfa_grace_until: null, days_since_login: null };

const summary: AccessReviewSummary = {
  generated_at: '2026-10-05T16:00:00Z',
  accounts: 12,
  by_role: { ADMIN: 1, COMPANY: 3 },
  inactive: 1,
  never_signed_in: 2,
  stale: 1,
  locked: 1,
  privileged: 4,
  privileged_without_mfa: 1,
  active_api_keys: 3,
  api_keys_expiring_soon: 1,
  controls: {
    mfa_required_for: ['ADMIN', 'COMPANY'],
    mfa_grace_days: 14,
    password_min_length: 12,
    password_history_size: 5,
    breached_password_check: true,
    argon2: { time_cost: 3, memory_mb: 64 },
    lockout_max_failures: 5,
    lockout_minutes: 15,
    session_absolute_minutes: 720,
    session_idle_minutes: 60,
    privileged_session_idle_minutes: 15,
    stale_days: 90,
  },
};

const csv = { filename: 'accesos-2026-10-05.csv', content_type: 'text/csv', data: 'ZQ==', rows: 12, limit: 5000, generated_at: summary.generated_at };

interface ServerOptions {
  accounts?: AccessReviewAccount[];
  summaryResponse?: Response;
  exportResponse?: Response;
  /** Respuesta del listado (por omisión, las cuentas de `accounts`). */
  listResponse?: Response;
}

function server({ accounts = [company, stale, ok], summaryResponse = apiOk(summary), exportResponse = apiOk(csv), listResponse }: ServerOptions = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/admin/access-review/export')) return exportResponse;
    if (call.url.includes('/admin/access-review/summary')) return summaryResponse;
    return listResponse ?? apiOk({ items: accounts, total: accounts.length, page: 1, size: 10 });
  });
}

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/admin/access-review" element={<AccessReviewPage />} />
    </Routes>,
    { route: '/admin/access-review' },
  );

const listRequests = (calls: MockCall[]) => calls.filter((c) => /\/admin\/access-review(\?|$)/.test(c.url));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccessReviewPage (revisión de accesos, ADMIN)', () => {
  it('indicadores, cuentas por rol y el resumen fechado', async () => {
    server();
    const { container } = renderPage();
    expect(await screen.findByText('admin@acme.mx')).toBeInTheDocument();
    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Cuentas', 'Sin segundo factor', 'Sin entrar hace tiempo', 'Bloqueadas', 'Llaves por vencer']);
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[0]).toHaveTextContent('12'));
    expect(screen.getByText(/Administrador: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Informe del/)).toHaveTextContent('2 sin entrar nunca');
    expect(screen.getByText(/Informe del/)).toHaveTextContent('3 llaves de integración vigentes');
  });

  it('cada cuenta con su rol, su último acceso, su segundo factor, su alcance y lo que hay que revisar', async () => {
    server();
    renderPage();
    const row = (await screen.findByText('admin@acme.mx')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Empresa');
    expect(row).toHaveTextContent('Acme');
    expect(row).toHaveTextContent('hace 1 día');
    expect(row).toHaveTextContent('Plazo hasta el');
    expect(row).toHaveTextContent('1 sesión abierta');
    expect(within(row).getByText('Sin llave de acceso')).toHaveClass('badge--danger');

    const staleRow = screen.getByText('viejo@acme.mx').closest('tr') as HTMLElement;
    expect(staleRow).toHaveTextContent('Plataforma');
    expect(staleRow).toHaveTextContent('Nunca ha entrado');
    expect(staleRow).toHaveTextContent('No se le exige');
    expect(staleRow).toHaveTextContent('Bloqueada hasta el');
    expect(staleRow).toHaveTextContent('Sin sesiones abiertas');
    expect(staleRow).toHaveTextContent('2 empleos vigentes');
    expect(within(staleRow).getByText('Bloqueada')).toHaveClass('badge--danger');
    expect(within(staleRow).getByText('Desactivada')).toHaveClass('badge--muted');

    const okRow = screen.getByText('root@acme.mx').closest('tr') as HTMLElement;
    expect(okRow).toHaveTextContent('Cumple con 2 llaves');
    expect(within(okRow).getByText('Todo en orden')).toHaveClass('badge--success');
  });

  it('los controles DECLARADOS salen del servidor, con los nombres del catálogo de roles', async () => {
    server();
    renderPage();
    expect(await screen.findByText('Controles declarados')).toBeInTheDocument();
    expect(screen.getByText(/Lo que la plataforma aplica hoy/)).toBeInTheDocument();
    expect(screen.getByText('Administrador y Empresa')).toBeInTheDocument();
    expect(screen.getByText('12 caracteres')).toBeInTheDocument();
    expect(screen.getByText('3 pasadas · 64 MB de memoria')).toBeInTheDocument();
    expect(screen.getByText('5 intentos · 15 min')).toBeInTheDocument();
  });

  it('los filtros y la búsqueda viajan al servidor y vuelven a pedir el listado', async () => {
    const { calls } = server();
    renderPage();
    await screen.findByText('admin@acme.mx');
    await userEvent.click(screen.getByLabelText('Sin segundo factor'));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('without_mfa=true'));
    await userEvent.click(screen.getByLabelText('Bloqueadas'));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('locked=true'));
    await userEvent.click(screen.getByRole('button', { name: /^Rol/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Empresa' }));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('role=COMPANY'));
    await userEvent.type(screen.getByLabelText('Buscar por correo'), 'admin');
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('search=admin'), { timeout: 2000 });
  });

  it('un resumen sin cuentas por rol lo dice en lugar de dejar la fila vacía', async () => {
    server({ summaryResponse: apiOk({ ...summary, by_role: {} }) });
    renderPage();
    expect(await screen.findByText('Sin cuentas que contar.')).toBeInTheDocument();
  });

  it('si la lista falla, el popup lo dice con su título y se vuelve a pedir', async () => {
    const { calls } = server({ listResponse: apiFail(503, 'SERVICE_UNAVAILABLE') });
    renderPage();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las cuentas' });
    const before = listRequests(calls).length;
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(listRequests(calls).length).toBeGreaterThan(before));
  });

  it('sin cuentas lo dice; con filtros, que nada coincide; si el resumen falla, se reintenta', async () => {
    server({ accounts: [], summaryResponse: apiFail(503, 'SERVICE_UNAVAILABLE') });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sin cuentas')).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText('Sin entrar hace tiempo'));
    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeInTheDocument());
  });
});

describe('AccessReviewPage: exportar el informe', () => {
  it('pregunta antes, descarga el CSV del servidor y dice cuántas cuentas llevó', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    server();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar el informe?' });
    expect(within(ask).getByText(/Lleva datos de acceso/)).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Informe exportado')).toBeInTheDocument();
    expect(screen.getByText('12 cuentas')).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
  });

  it('al llegar al tope del servidor avisa que hay que filtrar más', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    server({ exportResponse: apiOk({ ...csv, rows: 5000 }) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar el informe?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText(/Se alcanzó el tope de 5,000 filas/)).toBeInTheDocument();
  });

  it('con filtros la confirmación lo dice y una falla se explica con el error del servidor', async () => {
    server({ exportResponse: apiFail(503, 'SERVICE_UNAVAILABLE', 'El servidor no está disponible.') });
    renderPage();
    await screen.findByText('admin@acme.mx');
    await userEvent.click(screen.getByLabelText('Bloqueadas'));
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar el informe?' });
    expect(within(ask).getByText(/Se descarga un archivo CSV con las cuentas del filtro/)).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('No se pudo exportar el informe')).toBeInTheDocument();
  });

  it('en inglés, el informe y sus controles salen en el idioma activo', async () => {
    await setLocale('en-US');
    server();
    renderPage();
    expect(await screen.findByText('Access review')).toBeInTheDocument();
    expect(screen.getByText('Declared controls')).toBeInTheDocument();
    expect(screen.getByText('12 characters')).toBeInTheDocument();
  });
});
