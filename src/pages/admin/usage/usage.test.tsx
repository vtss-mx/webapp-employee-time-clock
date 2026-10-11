import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { companyUsage, page, routeUsage, usageOverview, usageRow, userUsage } from '../../../test/billing';
import { adminUser, pick, renderPage, retype, settle } from '../../../test/companyPages';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import type { CompanyUsage, UsageOverview, User } from '../../../types';
import { defaultRange, usagePresets } from '../../../utils/usage';
import { CompanyUsagePage } from './CompanyUsagePage';
import { UsagePage } from './UsagePage';

// La actualización periódica se prueba en su hook; aquí se ejecuta a mano lo que cada pantalla le pasa.
const refreshers = vi.hoisted(() => [] as Array<() => void>);
vi.mock('../../../hooks/useAutoRefresh', () => ({ useAutoRefresh: (refresh: () => void) => refreshers.push(refresh) }));

const month = defaultRange();
const lastMonth = usagePresets().find((preset) => preset.key === 'last-month') as { start: string; end: string };
const urls = (calls: MockCall[], part: string) => calls.filter((c) => c.url.includes(part)).map((c) => c.url);
const typed = (iso: string) => iso.split('-').reverse().join('');

describe('UsagePage (consumo de la plataforma)', () => {
  function renderUsage({ overview = () => apiOk(usageOverview), rows = [usageRow], route = '/admin/usage' }: { overview?: () => Response; rows?: unknown[]; route?: string } = {}) {
    const mock = mockFetch((call) => (call.url.includes('/overview') ? overview() : page(rows)));
    renderPage('/admin/usage', route, <UsagePage />, { targets: { '/admin/usage/companies/:id': 'Consumo de la empresa' } });
    return mock.calls;
  }

  it('indicadores, gráficas día por día, almacenamiento y las empresas; una fila abre su consumo con el mismo rango', async () => {
    const calls = renderUsage({ route: `/admin/usage?start=${lastMonth.start}&end=${lastMonth.end}` });
    expect(await screen.findByText('1 oct 2026 – 4 oct 2026 · 3 empresas con actividad')).toBeInTheDocument();
    expect(urls(calls, '/overview')[0]).toBe(`/api/admin/usage/overview?start=${lastMonth.start}&end=${lastMonth.end}`);
    expect([...document.querySelectorAll('.kpi__label')].map((label) => label.textContent)).toEqual([
      'Peticiones',
      'Datos de entrada',
      'Datos de salida',
      'Tiempo de proceso',
      'Fallas del servidor (5xx)',
      'Rechazos (4xx)',
      'Almacenamiento',
    ]);
    await waitFor(() => expect(document.querySelectorAll('.kpi__value')[2]).toHaveTextContent('2,048.00 MB'));
    expect(screen.getByText('Promedio 150 ms por petición')).toBeInTheDocument();
    expect(screen.getByText('9,000 registros')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Peticiones por día\. 2 días\. Total Peticiones: 4,000/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Datos por día\. 2 días\. Total Entrada: 5\.00 MB; Salida: 2,048\.00 MB/ })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Almacenamiento por categoría' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Biometría20.00 MB1,000 registros',
      'Verificaciones10.00 MB8,000 registros',
    ]);
    expect(screen.getByText('Foto del 4 oct 2026 · 30.00 MB en 9,000 registros')).toBeInTheDocument();
    const row = (await screen.findByText('Panificadora')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Activos: 10 empleados y 1 validador'); // cada validador activo se cobra como un empleado
    expect(row).toHaveTextContent('62.5 % del total');
    expect(row).toHaveTextContent('5.00 MB / 2,048.00 MB');
    expect(row).toHaveTextContent('31 minpromedio 150 ms');

    await settle(() => refreshers.at(-1)?.());
    await waitFor(() => expect(urls(calls, '/overview')).toHaveLength(2));
    await userEvent.click(row);
    expect(await screen.findByText('Consumo de la empresa')).toBeInTheDocument();
  });

  it('el rango: rangos de un clic, fechas a mano (uno inválido no consulta) y "Este mes" limpia la URL; orden y búsqueda', async () => {
    const calls = renderUsage();
    await screen.findByText(/empresas con actividad/);
    expect(urls(calls, '/overview')[0]).toBe(`/api/admin/usage/overview?start=${month.start}&end=${month.end}`);
    await userEvent.click(screen.getByRole('button', { name: 'Mes pasado' }));
    await waitFor(() => expect(urls(calls, '/overview').at(-1)).toContain(`start=${lastMonth.start}`));
    expect(screen.getByRole('button', { name: 'Mes pasado' })).toHaveAttribute('aria-pressed', 'true');

    const before = urls(calls, '/overview').length;
    await retype('Hasta', typed('2020-01-01')); // antes de "Desde": no se consulta
    expect(screen.getByLabelText('Hasta')).toHaveAccessibleDescription('Debe ser igual o posterior a «Desde»');
    await retype('Desde', '0101'); // a medias: sin error todavía
    expect(screen.getByLabelText('Desde')).not.toHaveAccessibleDescription();
    expect(urls(calls, '/overview')).toHaveLength(before);
    await retype('Desde', typed('2019-12-01'));
    await waitFor(() => expect(urls(calls, '/overview').at(-1)).toContain('start=2019-12-01&end=2020-01-01'));

    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    await waitFor(() => expect(urls(calls, '/overview').at(-1)).toContain(`start=${month.start}`));
    await pick(/Ordenar por/, /Más almacenamiento/);
    await waitFor(() => expect(urls(calls, '/usage/companies').at(-1)).toContain('sort=storage'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empresas' }), 'pan');
    await waitFor(() => expect(urls(calls, '/usage/companies').at(-1)).toContain('search=pan'));
  });

  it('sin foto del almacenamiento, sin fallas del servidor y sin empresas; si no carga, "Volver a cargar"', async () => {
    let tries = 0;
    const quiet: UsageOverview = { ...usageOverview, totals: { ...usageOverview.totals, server_errors: 0 }, storage: { day: null, rows: 0, bytes: 0, items: [] } };
    renderUsage({ overview: () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(quiet)), rows: [] });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el consumo' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(await screen.findByText('Sin consumo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Sin foto del almacenamiento')).toBeInTheDocument();
    expect(document.querySelectorAll('.icon-tile')[4]).toHaveClass('icon-tile--success');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empresas' }), 'zz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('si la lista de empresas no carga, su popup lo dice', async () => {
    mockFetch((call) => (call.url.includes('/overview') ? apiOk(usageOverview) : apiFail(500, 'INTERNAL_ERROR', 'Falló')));
    renderPage('/admin/usage', '/admin/usage', <UsagePage />);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el consumo de las empresas' })).toBeInTheDocument();
  });
});

describe('CompanyUsagePage (consumo de una empresa)', () => {
  interface Options {
    usage?: () => Response;
    route?: string;
    user?: User | null;
  }
  function renderCompany({ usage = () => apiOk(companyUsage), route = '/admin/usage/companies/4', user }: Options = {}) {
    const mock = mockFetch((call) => {
      if (call.url.includes('/users')) return page([userUsage, { ...userUsage, user_id: 9, name: null, email: null, role: null }, { ...userUsage, user_id: 10, name: null, email: 'rh@pan.com', role: 'COMPANY' }]);
      if (call.url.includes('/routes')) return page([routeUsage]);
      return usage();
    });
    renderPage('/admin/usage/companies/:id', route, <CompanyUsagePage />, { user, targets: { '/admin/usage': 'Consumo general' } });
    return mock.calls;
  }

  it('totales, rutas más usadas, almacenamiento y el costo estimado frente al consumo; usuarios y rutas en pestañas', async () => {
    const calls = renderCompany({ route: '/admin/usage/companies/4?start=2026-09-01&end=2026-09-30', user: adminUser });
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cobranza' })).toHaveAttribute('href', '/admin/billing/companies/4');
    expect(screen.getByRole('link', { name: /Consumo/ })).toHaveAttribute('href', '/admin/usage?start=2026-09-01&end=2026-09-30');
    expect(urls(calls, '/usage/companies/4?')[0]).toBe('/api/admin/usage/companies/4?start=2026-09-01&end=2026-09-30');
    expect(screen.getByRole('list', { name: 'Rutas más usadas' })).toHaveTextContent('GET /api/employees/{employee_id}12,400promedio 150 ms');
    const cost = screen.getByRole('heading', { name: 'Costo frente a consumo' }).closest('section') as HTMLElement;
    expect(cost).toHaveTextContent('Activos hoy10 empleados y 2 validadores');
    expect(cost).toHaveTextContent('PlanPor empleado activo · $120.00 MXN por mes');
    expect(cost).toHaveTextContent('Pronóstico del cargo en curso$1,392.00 MXN con IVA');
    expect(cost).toHaveTextContent('Costo estimado por 1,000 peticiones≈ $112.26 MXN por cada 1,000');
    expect(cost).toHaveTextContent('Costo estimado por MB transferido≈ $0.68 MXN por MB');

    const users = await screen.findByText('Ana Ruiz');
    expect(users.closest('tr')).toHaveTextContent('ana@pan.com');
    expect(users.closest('tr')).toHaveTextContent('Empleado');
    expect(screen.getByText('Usuario 9').closest('tr')).toHaveTextContent('—');
    expect(screen.getByText('rh@pan.com').closest('tr')).toHaveTextContent('Cuenta sin empleado en la empresa');
    expect(urls(calls, '/users')[0]).toBe('/api/admin/usage/companies/4/users?start=2026-09-01&end=2026-09-30&page=1&size=10');

    await userEvent.click(screen.getByRole('tab', { name: 'Rutas' }));
    expect(await screen.findByText('980 ms')).toBeInTheDocument();
    expect(urls(calls, '/routes')[0]).toContain('start=2026-09-01');
    await userEvent.click(screen.getByRole('tab', { name: 'Usuarios' }));
    expect(screen.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute('aria-selected', 'true');
    await settle(() => refreshers.at(-1)?.());
    await waitFor(() => expect(urls(calls, '/usage/companies/4?')).toHaveLength(2));
  });

  it('el costo estimado va en la moneda de la empresa; en inglés, los textos del consumo y del costo', async () => {
    await setLocale('en-US');
    renderCompany({ usage: () => apiOk({ ...companyUsage, billing: { ...companyUsage.billing!, currency: 'USD', unit_price: '10.00', forecast_total: '116.00' } }) });
    const cost = (await screen.findByRole('heading', { name: 'Cost versus usage' })).closest('section') as HTMLElement;
    expect(cost).toHaveTextContent('Current charge forecast$116.00 USD incl. VAT');
    expect(cost).toHaveTextContent('Estimated cost per 1,000 requests≈ $9.35 USD per 1,000');
    expect(cost).toHaveTextContent('only compare it with companies in the same currency');
    expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sin plan no hay costo; sin pronóstico o sin peticiones no se estima; sin rutas lo dice; sin la pantalla de cobranza no hay enlace', async () => {
    let current: CompanyUsage = { ...companyUsage, billing: null, top_routes: [] };
    renderCompany({ usage: () => apiOk(current), route: '/admin/usage/companies/4?tab=routes' });
    expect(await screen.findByText('Sin plan de cobro')).toBeInTheDocument();
    expect(screen.getByText('Sin peticiones', { selector: '.empty-state__title' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cobranza' })).toBeNull();
    expect(screen.getByRole('link', { name: /Consumo/ })).toHaveAttribute('href', '/admin/usage');
    expect(screen.getByRole('tab', { name: 'Rutas' })).toHaveAttribute('aria-selected', 'true');

    current = { ...companyUsage, totals: { ...companyUsage.totals, requests: 0, bytes_in: 0, bytes_out: 0 }, billing: { ...companyUsage.billing!, forecast_total: null } };
    await settle(() => refreshers.at(-1)?.());
    const cost = (await screen.findByText('Aún sin calcular')).closest('section') as HTMLElement;
    expect(within(cost).getAllByText('Sin datos suficientes')).toHaveLength(2);
  });

  it('si el detalle por usuario o por ruta no carga, su popup lo dice', async () => {
    mockFetch((call) => (call.url.includes('/users') || call.url.includes('/routes') ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(companyUsage)));
    renderPage('/admin/usage/companies/:id', '/admin/usage/companies/4', <CompanyUsagePage />);
    const users = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el consumo por usuario' });
    await userEvent.click(within(users).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('tab', { name: 'Rutas' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el consumo por ruta' })).toBeInTheDocument();
  });

  it('si el consumo de la empresa no carga, "Volver a cargar"', async () => {
    let tries = 0;
    renderCompany({ usage: () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(companyUsage)) });
    expect(screen.getByRole('heading', { name: 'Consumo de la empresa' })).toBeInTheDocument();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el consumo de la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
  });
});
