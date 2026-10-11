import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { sampleAdminPolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { CompanyDetail, CompanyEmployee, ErrorReportDetail } from '../../types';
import type { FaceSecurityOverview } from '../../types/faceSecurity';
import { CompaniesListPage } from './CompaniesListPage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { CompanyEmployeesPage } from './CompanyEmployeesPage';
import { CompanyPolicyPage } from './CompanyPolicyPage';
import { ErrorDetailPage } from './ErrorDetailPage';
import { ErrorsPage } from './ErrorsPage';
import { FaceSecurityPage } from './FaceSecurityPage';

/*
 * Consola del ADMIN en inglés (en-US): pantallas, confirmaciones y avisos con los textos del
 * diccionario en-US, y confirmaciones abiertas que cambian de idioma en caliente. Los nombres de los
 * catálogos (seguimiento, gravedad, modos del destello) vienen del backend: aquí, los de prueba.
 */

const company = { id: 4, name: 'Panificadora', active: true, employee_count: 2, admin_count: 1 } as CompanyDetail;

function renderAt(path: string, route: string, page: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={page} />
    </Routes>,
    { route },
  );
}

beforeEach(async () => {
  await setLocale('en-US');
});
afterEach(() => resetPolicyCache());

describe('CompanyPolicyPage en inglés', () => {
  it('secciones, reglas y su confirmación en inglés; la confirmación abierta sigue al idioma', async () => {
    const policy = { ...sampleAdminPolicy, two_person_rule: false, updated_at: '2026-10-01T10:00:00Z', updated_by: 'root@plataforma.com' };
    mockFetch((call) => {
      if (call.url.endsWith('/face-learning')) return apiOk({ enabled: true, approved_employees: 0, employees_learning: 0, learned_samples: 0, identifications: 0, learned_identifications: 0, last_learned_at: null });
      if (call.url.includes('/verification-policy/changes')) return apiOk({ items: [], total: 0, page: 1, size: 5 });
      if (!call.url.includes('/verification-policy')) return apiOk(company);
      return apiOk(call.init.method === 'PUT' ? { policy: { ...policy, ...(JSON.parse(call.init.body as string) as object) }, change: null } : policy);
    });
    renderAt('/admin/companies/:id/policy', '/admin/companies/4/policy', <CompanyPolicyPage />);
    const lock = await screen.findByRole('switch', { name: 'Block virtual cameras' });
    expect(screen.getByRole('heading', { name: 'Identity verification policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anti-spoofing locks' })).toBeInTheDocument();
    expect(screen.getByText('When identifying among all employees').tagName).toBe('STRONG');
    expect(screen.getAllByText('Recommended').length).toBeGreaterThan(0);

    await userEvent.click(lock);
    const confirm = await screen.findByRole('alertdialog', { name: 'Turn off “Block virtual cameras”?' });
    expect(confirm).toHaveTextContent('This reduces protection against identity spoofing');
    expect(confirm).toHaveTextContent('Applies within seconds to all Panificadora staff.');
    await act(() => setLocale('es-MX'));
    expect(await screen.findByRole('alertdialog', { name: '¿Desactivar «Bloquear cámaras virtuales»?' })).toHaveTextContent('Aplica en segundos a todo el personal de Panificadora.');
    await act(() => setLocale('en-US'));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Turn off “Block virtual cameras”?' })).getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByRole('dialog', { name: 'Block virtual cameras: off' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

    await userEvent.click(screen.getByRole('button', { name: /Lockout duration/ }));
    await userEvent.click(screen.getByRole('option', { name: '2 h' }));
    const tuning = await screen.findByRole('dialog', { name: 'Change “Lockout duration” to 2 h?' });
    await userEvent.click(within(tuning).getByRole('button', { name: 'Save setting' }));
    expect(await screen.findByRole('dialog', { name: 'Lockout updated' })).toHaveTextContent('The lockout will last 2 h.');
  });
});

describe('FaceSecurityPage en inglés', () => {
  const overview: FaceSecurityOverview = {
    autocalibration: true,
    window_days: 30,
    min_samples: 300,
    interval_hours: 6,
    thresholds: [{ key: 'FLASH_SCORE', name: 'Flash score', value: 0.35, floor: 0.35, cap: 0.75, samples: 1, computed_at: null, raised: false }],
    escalation_min_attacks: 5,
    escalation_window_minutes: 30,
    reinforced: [{ company_id: 4, name: 'Panificadora', attacks: 1 }],
    flash: { measured: 120, conclusive: 100, inconclusive: 20, score_median: 0.62, score_p10: 0.3, magnitude_median: 0.012, ratio_median: 1.8, ratio_p10: 1.4 },
  };

  it('indicadores, calibración, empresas reforzadas y el destello en inglés; "Recalculate now" se confirma', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiOk(overview, { message: 'Recalculated 1 threshold.' }) : apiOk(overview)));
    renderAt('/admin/face-security', '/admin/face-security', <FaceSecurityPage />);
    expect(await screen.findByText(/^Every 6 h the platform measures the successful attempts from the last 30 days/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Face security' })).toBeInTheDocument();
    expect(screen.getByText('1 attempt measured', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 attempt')).toBeInTheDocument();
    expect(screen.getByText(/^With 5 suspicious attempts in 30 min/)).toBeInTheDocument();
    expect(screen.getByText('Calibrating')).toBeInTheDocument();
    expect(screen.getByText(/^Switch a company to “Obligatorio”.*keep it on “Solo medir”/)).toBeInTheDocument(); // nombres del catálogo
    expect(screen.getByText('Collect 300 conclusive measurements (100 so far).')).toBeInTheDocument();
    expect(screen.getByText('Fewer measurements with too much light: today 17% (maximum 10%).')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Recalculate now' }));
    const confirm = await screen.findByRole('dialog', { name: 'Recalculate the thresholds now?' });
    expect(confirm).toHaveTextContent('from the last 30 days, the same thing the platform does every 6 h');
    expect(within(confirm).getByRole('region', { name: 'Details' })).toHaveTextContent('Window30 daysMeasurements to move a threshold300');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Recalculate now' }));
    expect(await screen.findByRole('dialog', { name: 'Thresholds recalculated' })).toHaveTextContent('Recalculated 1 threshold.');
  });

  it('una ventana de un día y la autocalibración apagada', async () => {
    mockFetch(apiOk({ ...overview, autocalibration: false, window_days: 1, reinforced: [] }));
    renderAt('/admin/face-security', '/admin/face-security', <FaceSecurityPage />);
    expect(await screen.findByText(/^Auto-calibration is turned off/)).toBeInTheDocument();
    expect(screen.getByText(/^Successful attempts from the last day\./)).toBeInTheDocument();
    expect(screen.getByText('No companies under attack')).toBeInTheDocument();
  });
});

describe('Errores del sistema en inglés', () => {
  const report: ErrorReportDetail = {
    id: 9,
    source: 'LOG',
    severity: 'CRITICAL',
    status: 'PENDING',
    code: 'INTERNAL_ERROR',
    message: 'Unexpected error',
    http_status: null,
    method: null,
    location: 'app.services.x:12',
    exception_type: null,
    occurrences: 1234,
    reopened: 1,
    first_seen_at: '2026-10-01T10:00:00Z',
    last_seen_at: '2026-10-03T10:00:00Z',
    last_trace_id: null,
    status_changed_at: '2026-10-02T10:00:00Z',
    status_changed_by: 'root@plataforma.com',
    detail: null,
  };
  const inbox = (call: MockCall) => {
    if (call.url.includes('/summary')) return apiOk({ by_status: { PENDING: 2 }, open_by_severity: {}, pending: 2, last_seen_at: null });
    if (call.url.includes('/server')) return apiOk({ status: 'ok', components: {}, admission: { limit: 8, bounds: [8, 200], in_flight: 0, waiting: 0, admitted: 0, shed: 0, latency_ratio: null, top_demand: [] }, storage: { configured: false, backend: 'disabled', bucket: null, prefix: 'local', reason: 'No key', count_cap: 10000, images: [], tasks: [] } });
    if (call.init.method === 'POST') return apiOk({ resolved: 2 });
    return apiOk({ items: [report, { ...report, id: 10 }], total: 2, page: 1, size: 10, as_of: '2026-10-03T12:00:00Z' });
  };

  it('bandeja: columnas, filtros y "Mark as resolved" con su confirmación en inglés', async () => {
    mockFetch(inbox);
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText(/^2 pending · server and web app failures/)).toBeInTheDocument();
    for (const column of ['Error', 'Severity', 'Where', 'Times', 'Last seen', 'Follow-up']) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    expect(screen.getAllByText('1,234')).toHaveLength(2);
    expect(screen.getAllByText('· reopened 1×', { exact: false })).toHaveLength(2);
    expect(screen.getByText("No key. Face enrollments and receipts can't be saved until it's configured")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filter by follow-up/ }));
    await userEvent.click(await screen.findByRole('option', { name: /\(2\)$/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as resolved (2)' }));
    const confirm = await screen.findByRole('dialog', { name: 'Mark the 2 errors as resolved?' });
    expect(confirm).toHaveTextContent(/Includes the 2 errors with follow-up “.+”, not any that occur after the list was loaded\./);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Mark as resolved' }));
    expect(await screen.findByText('2 errors marked as resolved.')).toBeInTheDocument();
  });

  it('detalle: origen, ocurrencias, seguimiento y su confirmación en inglés', async () => {
    mockFetch((call) => (call.url.includes('/occurrences') ? apiOk({ items: [], total: 0, page: 1, size: 10 }) : apiOk(report)));
    renderAt('/admin/errors/:id', '/admin/errors/9', <ErrorDetailPage />);
    expect(await screen.findByText('Server process (background or internal)')).toBeInTheDocument();
    expect(screen.getByText('1,234 · reopened 1 time')).toBeInTheDocument();
    expect(screen.getByText('Handled (no exception)')).toBeInTheDocument();
    expect(screen.getByText(/^Last change: root@plataforma.com, /)).toBeInTheDocument();
    expect(screen.getByText('No stack trace: handled error (INTERNAL_ERROR).')).toBeInTheDocument();
    expect(await screen.findByText('No recent occurrences')).toBeInTheDocument();
    const [mark] = screen.getAllByRole('button', { name: /^Mark as / });
    await userEvent.click(mark);
    const confirm = await screen.findByRole('dialog', { name: /^Mark INTERNAL_ERROR as / });
    expect(within(confirm).getByRole('region', { name: 'Details' })).toHaveTextContent('MessageUnexpected errorWhereapp.services.x:12Occurrences1,234');
  });
});

describe('CompanyEmployeesPage en inglés', () => {
  const ana: CompanyEmployee = {
    id: 1,
    employee_number: 'E-001',
    first_name: 'Ana',
    last_name: 'López',
    email: 'ana@pan.com',
    phone: null,
    active: true,
    face_status: 'APPROVED',
    face_learned_samples: 1,
    face_last_learned_at: '2026-10-01T10:00:00Z',
  };

  it('lista de solo consulta y "Forget" con su confirmación en inglés', async () => {
    mockFetch((call) => (call.url.includes('/employees') ? apiOk({ items: [ana], total: 1, page: 1, size: 10 }) : apiOk(company)));
    renderAt('/admin/companies/:id/employees', '/admin/companies/4/employees', <CompanyEmployeesPage />);
    expect(await screen.findByRole('heading', { name: 'Panificadora employees' })).toBeInTheDocument();
    expect(await screen.findByText('1 registered · view only')).toBeInTheDocument();
    for (const column of ['Face enrollment', 'Learning']) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    expect(screen.getByText('No phone')).toBeInTheDocument();
    expect(screen.getByText('1 sample')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Forget' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Forget what was learned from Ana López?' });
    await waitFor(() => expect(within(confirm).getByRole('region', { name: 'To be deleted' })).toHaveTextContent(/Learned1 sample · /));
  });
});

describe('popups de error de la consola en inglés', () => {
  /** Cierra el popup con ese título (y deja ver el siguiente de la cola). */
  async function dismiss(title: string) {
    const popup = await screen.findByRole('alertdialog', { name: title });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Close' })[0]);
  }

  it('listas que no cargan: empresas, empleados de una empresa, errores y su resumen', async () => {
    mockFetch(() => apiFail(500, 'INTERNAL_ERROR', 'Server failed'));
    const companies = renderAt('/admin/companies', '/admin/companies', <CompaniesListPage />);
    await dismiss("Couldn't load the companies");
    companies.unmount();

    mockFetch((call) => (call.url.includes('/employees') ? apiFail(500, 'INTERNAL_ERROR', 'Server failed') : apiOk(company)));
    const employees = renderAt('/admin/companies/:id/employees', '/admin/companies/4/employees', <CompanyEmployeesPage />);
    await dismiss("Couldn't load the employees");
    employees.unmount();

    // El estado del servidor no responde (sin popup); la lista y su resumen fallan con códigos distintos
    // (la misma falla de dos cargas abre un solo popup), cada uno con su título.
    mockFetch((call) => {
      if (call.url.includes('/server')) return new Promise<Response>(() => undefined);
      return call.url.includes('/summary') ? apiFail(409, 'CONFLICT', 'Conflict') : apiFail(400, 'BAD_REQUEST', 'Bad request');
    });
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      const popup = await screen.findByRole('alertdialog');
      seen.push(document.getElementById(popup.getAttribute('aria-labelledby') ?? '')?.textContent ?? '');
      await userEvent.click(within(popup).getAllByRole('button', { name: 'Close' })[0]);
      await waitFor(() => expect(popup).not.toBeInTheDocument());
    }
    expect(seen.sort()).toEqual(["Couldn't load the error summary", "Couldn't load the errors"]);
  });

  it('detalle de un error: ocurrencias que no cargan y un seguimiento que no se guarda', async () => {
    const report = { id: 9, source: 'HTTP', severity: 'LOW', status: 'PENDING', code: 'X_FAILED', message: 'Failed', http_status: 500, method: 'GET', location: '/api/x', exception_type: null, occurrences: 1, reopened: 0, first_seen_at: '2026-10-01T10:00:00Z', last_seen_at: '2026-10-01T10:00:00Z', last_trace_id: null, status_changed_at: null, status_changed_by: null, detail: null };
    mockFetch((call) => {
      if (call.url.includes('/occurrences') || call.init.method === 'PATCH' || call.init.method === 'PUT') return apiFail(500, 'INTERNAL_ERROR', 'Server failed');
      return apiOk(report);
    });
    renderAt('/admin/errors/:id', '/admin/errors/9', <ErrorDetailPage />);
    await dismiss("Couldn't load its occurrences");
    const [mark] = await screen.findAllByRole('button', { name: /^Mark as / });
    await userEvent.click(mark);
    await userEvent.click(within(await screen.findByRole('dialog', { name: /^Mark X_FAILED as / })).getByRole('button', { name: /^Mark as / }));
    expect(await screen.findByRole('alertdialog', { name: "Couldn't update the follow-up" })).toBeInTheDocument();
  });

  it('detalle de una empresa: administradores que no cargan y una acción que falla', async () => {
    const detail = { ...company, legal_name: null, rfc: null, phone: null, max_employees: null, max_validators: 2, active_validators: 1, api_enabled: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    mockFetch((call) => {
      // La cobranza de la empresa no responde (sin popup): esta prueba es de los administradores y las acciones.
      if (call.url.includes('/admin/billing/')) return new Promise<Response>(() => undefined);
      if (call.url.includes('/admins') || call.init.method === 'PATCH') return apiFail(500, 'INTERNAL_ERROR', 'Server failed');
      return apiOk(detail);
    });
    renderAt('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    await dismiss("Couldn't load the admins");
    expect(screen.getByText('1 of 2 active')).toBeInTheDocument(); // sus validadores frente a su límite
    expect(screen.getByRole('meter', { name: 'Validator limit usage' })).toHaveAttribute('aria-valuenow', '50');
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Deactivate Panificadora?' })).getByRole('button', { name: 'Deactivate company' }));
    expect(await screen.findByRole('alertdialog', { name: "Couldn't complete the action" })).toBeInTheDocument();
  });
});
