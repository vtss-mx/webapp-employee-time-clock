import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { ReportAnswer, ReportCatalog, ReportPlan, SavedReport } from '../../../types';
import { ReportsPage } from './ReportsPage';

const plan = (changes: Partial<ReportPlan> = {}): ReportPlan => ({
  dataset: 'attendance',
  columns: [],
  filters: [],
  period: { start: '2026-10-03T06:00:00Z', end: '2026-10-04T06:00:00Z', label: 'hoy' },
  mode: 'count',
  group_by: [],
  metric: 'count',
  metric_column: null,
  sort: null,
  descending: null,
  limit: null,
  ...changes,
});

const answer = (changes: Partial<ReportAnswer> = {}): ReportAnswer => ({
  query_id: 10,
  answer: 'Hay 4 identificaciones (hoy).',
  highlights: ['33 % más que en el periodo anterior (3).'],
  understood: ['Datos: Identificaciones', 'Periodo: hoy'],
  plan: plan(),
  preview: { columns: [{ code: 'value', label: 'Total', kind: 'number' }], rows: [[4]], total: 1, truncated: false },
  alternatives: [{ code: 'workdays', name: 'Jornadas (entrada y salida)' }],
  export: false,
  suggestions: [],
  ...changes,
});

const catalog: ReportCatalog = {
  suggestions: ['¿Cuántas identificaciones hubo hoy?'],
  datasets: [
    {
      code: 'attendance',
      name: 'Identificaciones',
      description: 'Cada identificación.',
      time: 'occurred_at',
      examples: [],
      columns: [
        { code: 'occurred_at', label: 'Fecha y hora', kind: 'datetime', group: false, default: true, metric: false, options: [] },
        { code: 'department', label: 'Departamento', kind: 'text', group: true, default: true, metric: false, options: [{ value: 'Ventas', label: 'Ventas' }] },
        { code: 'success', label: 'Resultado', kind: 'bool', group: true, default: false, metric: false, options: [{ value: false, label: 'Fallida' }] },
      ],
    },
    {
      code: 'departments',
      name: 'Departamentos',
      description: 'Áreas.',
      time: null,
      examples: [],
      columns: [{ code: 'name', label: 'Departamento', kind: 'text', group: false, default: true, metric: false, options: [] }],
    },
  ],
};

const savedReport = (changes: Partial<SavedReport> = {}): SavedReport => ({
  id: 5,
  name: 'Asistencia de hoy',
  question: 'identificaciones de hoy',
  dataset: 'attendance',
  dataset_name: 'Identificaciones',
  plan: plan(),
  created_at: '2026-10-01T10:00:00Z',
  last_run_at: null,
  runs: 0,
  ...changes,
});

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });
const body = (call: MockCall) => JSON.parse(call.init.body as string) as Record<string, unknown>;
const excel = () =>
  new Response(new Blob(['xlsx']), {
    status: 200,
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="reporte-identificaciones-2026-10-03.xlsx"' },
  });

interface Backend {
  ask?: (call: MockCall) => Response;
  saved?: SavedReport[];
  other?: (call: MockCall) => Response | undefined;
}

/** Backend simulado de /api/reports (cada prueba cambia lo que necesita). */
function backend({ ask = () => apiOk(answer()), saved = [], other }: Backend = {}) {
  return mockFetch((call: MockCall) => {
    const custom = other?.(call);
    if (custom) return custom;
    if (call.url.includes('/reports/catalog')) return apiOk(catalog);
    if (call.url.includes('/reports/ask')) return ask(call);
    if (call.url.includes('/reports/export')) return excel();
    if (call.url.includes('/reports/preview')) return apiOk(answer({ query_id: null, understood: [] }));
    if (call.url.includes('/run')) return apiOk(answer({ answer: 'Generado otra vez' }));
    if (call.init.method === 'DELETE') return apiOk(null);
    if (call.url.includes('/reports/saved') && call.init.method === 'POST') return apiOk(savedReport({ name: String(body(call).name) }));
    return apiOk(page(saved));
  });
}

let downloads: string[];
beforeEach(() => {
  downloads = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:reporte'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

const askQuestion = async (text: string) => {
  await userEvent.type(await screen.findByLabelText('Tu pregunta'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Preguntar' }));
};

describe('Reportes: asistente', () => {
  it('responde con datos, hallazgos y cómo entendió; la siguiente pregunta sigue la conversación', async () => {
    const { calls } = backend();
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Pregúntame sobre tus datos')).toBeInTheDocument();
    await askQuestion('identificaciones de hoy');
    expect(await screen.findByText('Hay 4 identificaciones (hoy).')).toBeInTheDocument();
    expect(screen.getByText(/33 % más que en el periodo anterior/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Cómo entendí tu pregunta' })).getByText('Periodo: hoy')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '4' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tu pregunta')).toHaveValue('');

    await askQuestion('y por departamento');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/reports/ask'))).toHaveLength(2));
    const second = calls.filter((c) => c.url.includes('/reports/ask'))[1];
    expect(body(second)).toMatchObject({ question: 'y por departamento', context: { dataset: 'attendance' } });
  });

  it('las sugerencias preguntan con un clic; una pregunta vacía no se envía', async () => {
    const { calls } = backend();
    renderWithProviders(<ReportsPage />);
    await userEvent.click(await screen.findByRole('button', { name: '¿Cuántas identificaciones hubo hoy?' }));
    expect(await screen.findByText('Hay 4 identificaciones (hoy).')).toBeInTheDocument();
    expect(screen.getByText(/lo que más preguntas/)).toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText('Tu pregunta').closest('form') as HTMLFormElement);
    expect(calls.filter((c) => c.url.includes('/reports/ask'))).toHaveLength(1);
  });

  it('si no entendió, se aclara con un clic y aprende (y responde de nuevo)', async () => {
    const { calls } = backend({
      ask: () => apiOk(answer({ plan: null, preview: null, understood: [], answer: 'No encontré a qué datos te refieres con «ponche».', alternatives: [{ code: 'attendance', name: 'Identificaciones' }] })),
      other: (call) =>
        call.url.includes('/feedback') ? apiOk({ learned: ['«ponche» → Identificaciones'], answer: answer({ answer: 'Hay 9 identificaciones.' }) }) : undefined,
    });
    renderWithProviders(<ReportsPage />);
    await askQuestion('ponches');
    expect(await screen.findByText('¿De qué datos hablas?')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).queryByRole('button', { name: 'Exportar a Excel' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Identificaciones' }));
    expect(await screen.findByText('Hay 9 identificaciones.')).toBeInTheDocument();
    expect(screen.getByText(/Aprendí: «ponche» → Identificaciones/)).toBeInTheDocument();
    expect(body(calls.find((c) => c.url.includes('/feedback')) as MockCall)).toEqual({ query_id: 10, dataset: 'attendance' });
    expect(screen.getByText('¿O te referías a…?')).toBeInTheDocument();
  });

  it('una aclaración sin respuesta nueva no agrega nada', async () => {
    backend({ other: (call) => (call.url.includes('/feedback') ? apiOk({ learned: [], answer: null }) : undefined) });
    renderWithProviders(<ReportsPage />);
    await askQuestion('identificaciones');
    await userEvent.click(await screen.findByRole('button', { name: 'Jornadas (entrada y salida)' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  });

  it('se califica una respuesta (y ya no se vuelve a preguntar)', async () => {
    const { calls } = backend({ other: (call) => (call.url.includes('/feedback') ? apiOk({ learned: [], answer: null }) : undefined) });
    renderWithProviders(<ReportsPage />);
    await askQuestion('identificaciones');
    await askQuestion('identificaciones de ayer');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'No me sirvió' })).toHaveLength(2));
    await userEvent.click(screen.getAllByRole('button', { name: 'No me sirvió' })[1]);
    expect(await screen.findByText('Lo tomaré en cuenta para entenderte mejor.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Me sirvió' })).toHaveLength(1); // solo la que no calificó
    expect(body(calls.find((c) => c.url.includes('/feedback')) as MockCall)).toEqual({ query_id: 10, helpful: false });
  });

  it('un 👍 también se agradece', async () => {
    backend({ other: (call) => (call.url.includes('/feedback') ? apiOk({ learned: [], answer: null }) : undefined) });
    renderWithProviders(<ReportsPage />);
    await askQuestion('identificaciones');
    await userEvent.click(await screen.findByRole('button', { name: 'Me sirvió' }));
    expect(await screen.findByText('Seguiré respondiendo así.')).toBeInTheDocument();
  });

  it('exporta a Excel con el nombre del servidor; «en Excel» lo descarga solo', async () => {
    const { calls } = backend({ ask: (call) => apiOk(answer({ export: String(body(call).question).includes('excel') })) });
    renderWithProviders(<ReportsPage />);
    await askQuestion('identificaciones de hoy en excel');
    await waitFor(() => expect(downloads).toEqual(['reporte-identificaciones-2026-10-03.xlsx']));
    expect(body(calls.find((c) => c.url.includes('/export')) as MockCall)).toMatchObject({ query_id: 10, question: 'identificaciones de hoy en excel' });
    await userEvent.click(within(screen.getByRole('article')).getByRole('button', { name: 'Exportar a Excel' }));
    await waitFor(() => expect(downloads).toHaveLength(2));
  });

  it('«expórtalo» sin datos que exportar no descarga nada', async () => {
    backend({ ask: () => apiOk(answer({ export: true, plan: null, preview: null, answer: 'No encontré datos para exportar.' })) });
    renderWithProviders(<ReportsPage />);
    await askQuestion('expórtalo');
    expect(await screen.findByText('No encontré datos para exportar.')).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('guardar con un nombre que ya existe usa «(2)» y recarga los guardados', async () => {
    const names: string[] = [];
    const { calls } = backend({
      other: (call) => {
        if (!(call.url.includes('/reports/saved') && call.init.method === 'POST')) return undefined;
        names.push(String(body(call).name));
        return names.length === 1 ? apiFail(409, 'REPORT_NAME_TAKEN', 'Ya tienes un reporte con ese nombre') : apiOk(savedReport({ name: names[1] }));
      },
    });
    renderWithProviders(<ReportsPage />);
    await askQuestion('identificaciones de hoy');
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/«identificaciones de hoy \(2\)» quedó en tus reportes guardados/)).toBeInTheDocument();
    expect(names).toEqual(['identificaciones de hoy', 'identificaciones de hoy (2)']);
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/reports/saved?')).length).toBeGreaterThanOrEqual(2));
  });

  it('si el asistente falla, lo explica en un popup', async () => {
    backend({ ask: () => apiFail(422, 'VALIDATION_ERROR', 'La pregunta es muy larga') });
    renderWithProviders(<ReportsPage />);
    await askQuestion('x');
    expect(await screen.findByRole('alertdialog', { name: 'El asistente no pudo responder' })).toBeInTheDocument();
  });

  it('si el catálogo no carga, se puede volver a intentar', async () => {
    let attempts = 0;
    backend({ other: (call) => (call.url.includes('/catalog') && attempts++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : undefined) });
    renderWithProviders(<ReportsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Pregúntame sobre tus datos')).toBeInTheDocument();
  });
});

describe('Reportes: constructor guiado', () => {
  it('arma el plan con datos, forma, periodo, filtro y columnas; vista previa, Excel y guardar', async () => {
    const { calls } = backend();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Armar un reporte');
    await userEvent.click(screen.getByRole('button', { name: /Tipo de reporte/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Totales agrupados' }));
    await userEvent.click(screen.getByRole('button', { name: /Agrupar por/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Resultado' }));
    await userEvent.type(screen.getByLabelText('Desde'), '01/10/2026');
    await userEvent.type(screen.getByLabelText('Hasta'), '03/10/2026');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Departamento' }));
    await userEvent.click(screen.getByRole('button', { name: /Departamento/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Ventas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/preview'))).toBe(true));
    expect(body(calls.find((c) => c.url.includes('/preview')) as MockCall).plan).toMatchObject({
      dataset: 'attendance',
      mode: 'groups',
      group_by: ['success'],
      filters: [{ column: 'department', op: 'in', values: ['Ventas'] }],
      period: { start: '2026-10-01T00:00:00', end: '2026-10-04T00:00:00', label: 'desde el 01/10/2026 hasta el 03/10/2026' },
    });
    const preview = await screen.findAllByText('Hay 4 identificaciones (hoy).');
    expect(preview).toHaveLength(1);
    const card = screen.getByRole('article');
    await userEvent.click(within(card).getByRole('button', { name: 'Exportar a Excel' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/^«Identificaciones · .*» quedó en tus reportes guardados/)).toBeInTheDocument();
  });

  it('en detalle se eligen columnas; otros datos sin fecha ni agrupación cambian el formulario', async () => {
    const { calls } = backend();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Armar un reporte');
    await userEvent.click(screen.getByRole('button', { name: 'Resultado' })); // agrega la columna
    await userEvent.click(screen.getByRole('button', { name: 'Fecha y hora' })); // la quita
    await userEvent.click(screen.getAllByRole('button', { name: 'Exportar a Excel' })[0]);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/export'))).toBe(true));
    expect(body(calls.find((c) => c.url.includes('/export')) as MockCall).plan).toMatchObject({ columns: ['department', 'success'], period: null });

    await userEvent.click(screen.getByRole('button', { name: /^Datos/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Departamentos' }));
    expect(screen.queryByLabelText('Desde')).toBeNull();
    expect(screen.queryByRole('button', { name: /Filtrar por/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Tipo de reporte/ }));
    expect(screen.queryByRole('option', { name: 'Totales agrupados' })).toBeNull();
  });
});

describe('Reportes: guardados', () => {
  it('se generan de nuevo, se exportan y se borran (con confirmación)', async () => {
    const reports = [savedReport(), savedReport({ id: 6, name: 'Plantilla', runs: 1, last_run_at: '2026-10-02T10:00:00Z', question: null })];
    const { calls } = backend({ saved: reports });
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Asistencia de hoy')).toBeInTheDocument();
    expect(screen.getByText(/generado 1 vez · último/)).toBeInTheDocument();
    expect(screen.getByText(/generado 0 veces/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Generar' })[0]);
    expect(await screen.findByText('Generado otra vez')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Excel' })[1]);
    await waitFor(() => expect(downloads).toHaveLength(1));
    await userEvent.click(within(screen.getByText('Generado otra vez').closest('article') as HTMLElement).getByRole('button', { name: 'Exportar a Excel' }));
    await waitFor(() => expect(downloads).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: 'Borrar Plantilla' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar Plantilla' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText(/«Plantilla» ya no está en tus reportes guardados/)).toBeInTheDocument();
    expect(screen.getByText('Generado otra vez')).toBeInTheDocument(); // el resultado de otro reporte sigue

    await userEvent.click(screen.getByRole('button', { name: 'Borrar Asistencia de hoy' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(screen.queryByText('Generado otra vez')).toBeNull());
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual([expect.stringContaining('/reports/saved/6'), expect.stringContaining('/reports/saved/5')]);
  });

  it('la lista se atenúa mientras se recarga', async () => {
    let release: (response: Response) => void = () => undefined;
    let listed = 0;
    backend({
      saved: [savedReport()],
      other: (call) => {
        if (!call.url.includes('/reports/saved?') || listed++ === 0) return undefined;
        return new Promise<Response>((resolve) => (release = resolve)) as unknown as Response;
      },
    });
    const { container } = renderWithProviders(<ReportsPage />);
    const savedList = () => container.querySelector('ul.saved-reports');
    await userEvent.click(await screen.findByRole('button', { name: 'Generar' }));
    await waitFor(() => expect(savedList()).toHaveClass('is-loading'));
    release(apiOk(page([savedReport({ runs: 1 })])));
    await waitFor(() => expect(savedList()).not.toHaveClass('is-loading'));
  });

  it('sin reportes guardados explica para qué sirven', async () => {
    backend();
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Aún no guardas reportes')).toBeInTheDocument();
  });
});
