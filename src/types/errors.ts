// Errores del sistema (solo el ADMIN de la plataforma): GET/PATCH /api/admin/errors.

/** Seguimiento de un error (catálogo error_statuses). */
export type ErrorStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED';
/** Gravedad (catálogo error_severities). */
export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING';

/** Una falla agrupada: todas sus ocurrencias iguales (un 4xx no se registra: es un resultado normal). */
export interface ErrorReport {
  id: number;
  /** HTTP, LOG (segundo plano o dentro de un proceso), WEBSOCKET o CLIENT (falla de la aplicación web). */
  source: 'HTTP' | 'LOG' | 'WEBSOCKET' | 'CLIENT';
  severity: ErrorSeverity;
  status: ErrorStatus;
  code: string;
  message: string;
  http_status: number | null;
  method: string | null;
  /** Ruta sin ids (de la API o, si es CLIENT, de la pantalla) o archivo:línea. */
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

/** Lo que contó el navegador de una falla de la aplicación web (origen CLIENT). */
export interface ClientFailureContext {
  /** CRASH (pantalla rota), UNHANDLED (error sin capturar) o CONFIG (configuración de la plataforma). */
  kind: string;
  /** Pantalla tal cual (sin query). */
  path: string;
  component: string | null;
  detail: string | null;
  app_version: string | null;
  user_agent: string | null;
  ip: string | null;
}

/** Lo que se pidió y lo que se respondió, tal cual (si vino del log, dónde se registró; si de la app web, lo que contó el navegador). */
export interface ErrorContext {
  client?: ClientFailureContext;
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

/** Un tipo de imagen o archivo y cuántos hay en el bucket (ninguno vive en la base de datos). */
export interface StoredImageCount {
  kind: string;
  label: string;
  /** Objetos en el bucket; a lo más `count_cap`. */
  stored: number;
}

/** Una tarea del bucket en segundo plano (hoy `delete`: la cola de borrado) con su última vuelta. */
export interface StorageTask {
  task: string;
  label: string;
  /** Objetos en la cola; a lo más `count_cap`. */
  pending: number;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
}

/** Imágenes y archivos cifrados en el bucket privado (Google Cloud Storage / Firebase Storage): nunca en la BD. */
export interface ObjectStorageStatus {
  configured: boolean;
  /** gcs o disabled. */
  backend: string;
  bucket: string | null;
  /** Carpeta de este entorno dentro del bucket. */
  prefix: string;
  /** Por qué está apagado (sin bucket, sin llave, llave inválida). */
  reason: string | null;
  /** Los conteos llegan a lo más a este número ("10,000+"). */
  count_cap: number;
  images: StoredImageCount[];
  tasks: StorageTask[];
}

/** Estado del servidor (GET /api/admin/errors/server): dependencias, capacidad adaptativa y bucket de imágenes. */
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
  storage: ObjectStorageStatus;
}
