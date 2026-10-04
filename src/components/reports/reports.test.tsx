import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDownload } from '../../services/apiClient';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import type { CatalogDataset } from '../../types';
import { saveFile } from '../../utils/download';
import { initialState, planFrom } from './builderPlan';
import { ReportTable } from './ReportTable';
import { saveWithUniqueName } from './useReportActions';

const dataset: CatalogDataset = {
  code: 'attendance',
  name: 'Identificaciones',
  description: '',
  time: 'occurred_at',
  examples: [],
  columns: [{ code: 'success', label: 'Resultado', kind: 'bool', group: false, default: true, metric: false, options: [{ value: false, label: 'Fallida' }] }],
};

describe('plan del constructor', () => {
  it('sin columnas agrupables no propone agrupar; un periodo puede tener solo inicio o solo fin', () => {
    const state = initialState(dataset);
    expect(state.groupBy).toBe('');
    expect(planFrom({ ...state, from: '2026-10-01' }, dataset).period).toEqual({ start: '2026-10-01T00:00:00', end: null, label: 'desde el 01/10/2026' });
    expect(planFrom({ ...state, to: '2026-12-31' }, dataset).period).toEqual({ start: null, end: '2027-01-01T00:00:00', label: 'hasta el 31/12/2026' });
  });

  it('un filtro con un valor que ya no existe no se envía', () => {
    const plan = planFrom({ ...initialState(dataset), filterColumn: 'success', filterValue: 'true' }, dataset);
    expect(plan.filters).toEqual([]);
    expect(planFrom({ ...initialState(dataset), filterColumn: 'success', filterValue: 'false' }, dataset).filters).toEqual([{ column: 'success', op: 'in', values: [false] }]);
  });

  it('en datos sin fecha no se manda periodo', () => {
    const undated = { ...dataset, time: null };
    expect(planFrom({ ...initialState(undated), from: '2026-10-01' }, undated).period).toBeNull();
  });
});

describe('guardar con nombre único', () => {
  const plan = planFrom(initialState(dataset), dataset);

  it('sin nombre se llama «Reporte»; tras 5 nombres ocupados se rinde con el error', async () => {
    const { calls } = mockFetch(apiFail(409, 'REPORT_NAME_TAKEN', 'Ya existe'));
    await expect(saveWithUniqueName('   ', plan, null, null)).rejects.toBeInstanceOf(ApiError);
    const names = calls.map((call) => (JSON.parse(call.init.body as string) as { name: string }).name);
    expect(names).toEqual(['Reporte', 'Reporte (2)', 'Reporte (3)', 'Reporte (4)', 'Reporte (5)']);
  });

  it('otro error no se reintenta', async () => {
    const { calls } = mockFetch(apiFail(422, 'REPORT_INVALID_GROUP', 'Inválido'));
    await expect(saveWithUniqueName('Algo', plan, null, null)).rejects.toMatchObject({ code: 'REPORT_INVALID_GROUP' });
    expect(calls).toHaveLength(1);
  });
});

describe('tabla de vista previa', () => {
  it('formatea vacíos, números, sí/no y textos', () => {
    render(
      <ReportTable
        preview={{
          columns: [
            { code: 'a', label: 'A', kind: 'text' },
            { code: 'b', label: 'B', kind: 'number' },
            { code: 'c', label: 'C', kind: 'bool' },
            { code: 'd', label: 'D', kind: 'bool' },
            { code: 'e', label: 'E', kind: 'text' },
          ],
          rows: [[null, 1234.567, true, false, 'Ventas']],
          total: 1,
          truncated: false,
        }}
      />,
    );
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['—', '1,234.57', 'Sí', 'No', 'Ventas']);
    expect(screen.queryByText(/Mostrando/)).toBeNull();
  });

  it('si hay más filas que las mostradas, invita a exportar', () => {
    render(<ReportTable preview={{ columns: [{ code: 'a', label: 'A', kind: 'number' }], rows: [[1], [2]], total: 1500, truncated: true }} />);
    expect(screen.getByText('Mostrando 2 de 1,500. Exporta a Excel para tenerlos todos.')).toBeInTheDocument();
  });
});

describe('descarga de archivos', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('sin nombre del servidor usa el de respaldo y libera el enlace', async () => {
    mockFetch(new Response(new Blob(['x']), { status: 200 }));
    const file = await apiDownload('/reports/export', { method: 'POST' });
    expect(file.filename).toBeNull();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    vi.useFakeTimers();
    saveFile(file, 'reporte.xlsx');
    vi.runAllTimers();
    vi.useRealTimers();
    expect(names).toEqual(['reporte.xlsx']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('un error de la descarga llega con el sobre de siempre', async () => {
    mockFetch(apiFail(422, 'REPORT_UNKNOWN_DATASET', 'Ese reporte no existe'));
    await expect(apiDownload('/reports/export', { method: 'POST' })).rejects.toMatchObject({ code: 'REPORT_UNKNOWN_DATASET' });
    mockFetch(apiOk({ ok: true }));
    await expect(apiDownload('/reports/export', { method: 'POST' })).resolves.toMatchObject({ filename: null });
  });
});
