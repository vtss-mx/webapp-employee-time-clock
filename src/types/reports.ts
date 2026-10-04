// Asistente de reportes de la empresa (pantalla "Reportes"): /api/reports. El backend interpreta,
// valida y consulta SOLO los datos de la empresa de la sesión; aquí solo se dibuja lo que envía.

export type ReportScalar = string | number | boolean;
export type FilterOp = 'in' | 'not_in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';

export interface ReportFilter {
  column: string;
  op: FilterOp;
  values: ReportScalar[];
}

export interface ReportPeriod {
  start: string | null;
  end: string | null;
  label: string;
}

/** Lo que se consulta exactamente (lo arma el asistente o el constructor; el backend lo valida). */
export interface ReportPlan {
  dataset: string;
  columns: string[];
  filters: ReportFilter[];
  period: ReportPeriod | null;
  mode: 'rows' | 'count' | 'groups';
  group_by: string[];
  metric: 'count' | 'sum' | 'avg' | 'min' | 'max';
  metric_column: string | null;
  sort: string | null;
  descending: boolean | null;
  limit: number | null;
}

export interface ReportPreview {
  columns: { code: string; label: string; kind: string }[];
  /** Valores ya legibles (fechas, nombres de catálogo, sí/no). */
  rows: (string | number | boolean | null)[][];
  total: number;
  truncated: boolean;
}

export interface DatasetOption {
  code: string;
  name: string;
}

export interface ReportAnswer {
  query_id: number | null;
  answer: string;
  highlights: string[];
  understood: string[];
  plan: ReportPlan | null;
  preview: ReportPreview | null;
  alternatives: DatasetOption[];
  export: boolean;
  suggestions: string[];
}

export interface CatalogColumn {
  code: string;
  label: string;
  kind: string;
  group: boolean;
  default: boolean;
  metric: boolean;
  options: { value: ReportScalar; label: string }[];
}

export interface CatalogDataset {
  code: string;
  name: string;
  description: string;
  time: string | null;
  columns: CatalogColumn[];
  examples: string[];
}

export interface ReportCatalog {
  datasets: CatalogDataset[];
  suggestions: string[];
}

export interface FeedbackResult {
  learned: string[];
  answer: ReportAnswer | null;
}

export interface SavedReport {
  id: number;
  name: string;
  question: string | null;
  dataset: string;
  dataset_name: string;
  plan: ReportPlan;
  created_at: string;
  last_run_at: string | null;
  runs: number;
}
