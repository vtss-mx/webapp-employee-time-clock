// Errores del sistema (solo el ADMIN de la plataforma): GET/PATCH /api/admin/errors.

/** Seguimiento de un error (catálogo error_statuses). */
export type ErrorStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED';
/** Gravedad (catálogo error_severities). */
export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING';

/** Un error agrupado: todas sus ocurrencias iguales. */
export interface ErrorReport {
  id: number;
  /** HTTP, LOG (segundo plano o dentro de un proceso) o WEBSOCKET. */
  source: 'HTTP' | 'LOG' | 'WEBSOCKET';
  severity: ErrorSeverity;
  status: ErrorStatus;
  code: string;
  message: string;
  http_status: number | null;
  method: string | null;
  /** Ruta sin ids o archivo:línea. */
  location: string | null;
  exception_type: string | null;
  occurrences: number;
  /** Veces que volvió a ocurrir después de marcarse como solucionado. */
  reopened: number;
  first_seen_at: string;
  last_seen_at: string;
  last_trace_id: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
}

export interface ErrorReportDetail extends ErrorReport {
  /** Stack trace de la última ocurrencia. */
  detail: string | null;
}

export interface ErrorOccurrence {
  id: number;
  occurred_at: string;
  trace_id: string | null;
  message: string;
  /** Quién lo provocó: el correo de un ADMIN o de una empresa; de un empleado o validador solo su
   * rol y número de cuenta (el ADMIN de la plataforma no ve datos de los empleados). */
  user_label: string | null;
  company_name: string | null;
  /** Contexto literal (sin secretos ni archivos); null en ocurrencias anteriores a guardarlo. */
  context: ErrorContext | null;
}

/** Lo que se pidió y lo que se respondió, tal cual (o, si vino del log, dónde se registró). */
export interface ErrorContext {
  request?: {
    method?: string | null;
    path?: string | null;
    query?: Record<string, unknown> | null;
    ip?: string | null;
    headers?: Record<string, string>;
    body?: unknown;
    body_bytes?: number;
    body_truncated?: boolean;
  };
  response?: { status: number; body: unknown };
  user?: { id: number; email: string | null; role: string | null } | null;
  company_id?: number | null;
  duration_ms?: number;
  logger?: string;
  thread?: string;
  function?: string;
}

export interface ErrorSummary {
  by_status: Partial<Record<ErrorStatus, number>>;
  open_by_severity: Partial<Record<ErrorSeverity, number>>;
  pending: number;
  last_seen_at: string | null;
}

/** Una API (método + ruta sin ids) y su demanda reciente en el proceso que respondió. */
export interface ApiDemand {
  api: string;
  /** CRITICAL (identidad y acceso), NORMAL o BACKGROUND (tableros). */
  tier: 'CRITICAL' | 'NORMAL' | 'BACKGROUND';
  recent_requests: number;
  latency_ms: number | null;
  shed: number;
}

/** Estado del servidor (GET /api/admin/errors/server): dependencias y capacidad adaptativa. */
export interface ServerStatus {
  /** ok, degraded (sin motor facial) o unavailable (sin base de datos). */
  status: 'ok' | 'degraded' | 'unavailable';
  components: Record<string, { status: string; error?: string | null }>;
  admission: {
    limit: number;
    bounds: [number, number];
    in_flight: number;
    waiting: number;
    admitted: number;
    shed: number;
    latency_ratio: number | null;
    top_demand: ApiDemand[];
  };
}
