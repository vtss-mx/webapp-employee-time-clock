import type { CatalogDataset, ReportPlan } from '../../types';

export type BuilderMode = ReportPlan['mode'];

/** Lo que eligió la persona en el constructor de reportes. */
export interface BuilderState {
  dataset: string;
  mode: BuilderMode;
  groupBy: string;
  columns: string[];
  /** Fechas ISO (YYYY-MM-DD) del calendario, en la hora del negocio. */
  from: string;
  to: string;
  filterColumn: string;
  filterValue: string;
}

/** El estado inicial para unos datos: sus columnas de siempre, agrupado por la primera agrupable. */
export function initialState(dataset: CatalogDataset): BuilderState {
  return {
    dataset: dataset.code,
    mode: 'rows',
    groupBy: dataset.columns.find((c) => c.group)?.code ?? '',
    columns: dataset.columns.filter((c) => c.default).map((c) => c.code),
    from: '',
    to: '',
    filterColumn: '',
    filterValue: '',
  };
}

const display = (iso: string) => iso.split('-').reverse().join('/');

function nextDay(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function period(state: BuilderState): ReportPlan['period'] {
  if (!state.from && !state.to) return null;
  const label = [state.from && `desde el ${display(state.from)}`, state.to && `hasta el ${display(state.to)}`].filter(Boolean).join(' ');
  // Sin zona horaria: el backend las toma en la hora del negocio (medianoche de la empresa).
  return { start: state.from ? `${state.from}T00:00:00` : null, end: state.to ? `${nextDay(state.to)}T00:00:00` : null, label };
}

/** El plan que se envía al backend (que lo valida contra su catálogo antes de consultar). */
export function planFrom(state: BuilderState, dataset: CatalogDataset): ReportPlan {
  const column = dataset.columns.find((c) => c.code === state.filterColumn);
  const option = column?.options.find((o) => String(o.value) === state.filterValue);
  return {
    dataset: dataset.code,
    columns: state.mode === 'rows' ? state.columns : [],
    filters: column && option ? [{ column: column.code, op: 'in', values: [option.value] }] : [],
    period: dataset.time ? period(state) : null,
    mode: state.mode,
    group_by: state.mode === 'groups' ? [state.groupBy] : [],
    metric: 'count',
    metric_column: null,
    sort: null,
    descending: null,
    limit: null,
  };
}
