/**
 * Bitácora de auditoría (pantalla `ADMIN_AUDIT`, solo el ADMIN de la plataforma; migración 0095 del backend):
 * contrato de `/api/admin/audit`.
 *
 * Es EVIDENCIA de solo lectura: no hay tipos de entrada para crear, cambiar ni borrar un evento, porque ninguna
 * ruta lo permite. Los nombres de `action` y `outcome` NO se escriben en la app: salen de los catálogos
 * `audit_actions` y `audit_outcomes` (regla 1 de la raíz), así un código que esta versión no conoce se dibuja tal
 * cual (su código es un dato).
 */
import type { CatalogItem, Page, StatusItem } from './index';

/**
 * Catálogos de la bitácora que envía `GET /api/catalogs`: el nombre de cada acción y de cada resultado, con su
 * tono. Son la ÚNICA fuente de esos textos (regla 1 de la raíz: la app nunca los escribe) y un código que esta
 * versión no conoce se dibuja tal cual.
 */
export interface AuditCatalogs {
  audit_actions: CatalogItem[];
  audit_outcomes: StatusItem[];
}

/** Un evento: cuándo, quién, desde dónde, qué y sobre qué. */
export interface AuditEvent {
  id: number;
  occurred_at: string;
  /** Código del catálogo `audit_actions`. */
  action: string;
  /** Código del catálogo `audit_outcomes` (`OK`, `DENIED`, `FAILED`). */
  outcome: string;
  /** Correo LITERAL de quien la hizo al momento de la acción; null = la hizo el sistema. */
  actor_email: string | null;
  /** Código del catálogo `roles`; null en una acción del sistema. */
  actor_role: string | null;
  actor_id: number | null;
  /** Empresa de la que se trata; null = es de la plataforma. */
  company_id: number | null;
  company_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  /** Une el evento con «Errores del sistema» y con el log del proceso. */
  trace_id: string | null;
  /** El «antes → después» de un cambio, el filtro que se exportó o por qué se negó un acceso. */
  details: Record<string, unknown> | null;
}

/**
 * Una página de la bitácora, lo más reciente primero. `total` viene con tope y el tope lo manda el servidor en
 * `count_cap` (regla 25 de la raíz: la app no guarda copias de valores del backend); opcional por compatibilidad
 * con un backend anterior.
 */
export interface AuditEventList extends Page<AuditEvent> {
  /** El periodo que de verdad se consultó (sin filtro, los últimos días que fija el servidor). */
  since: string;
  until: string;
  /** Tope con que el servidor contó: `total` nunca pasa de aquí y la pantalla muestra «10,000+» al llegar. */
  count_cap?: number;
}

/** Cuántos eventos hubo de una acción con un resultado, en el periodo. */
export interface AuditActionCount {
  action: string;
  outcome: string;
  total: number;
}

/** Resumen del periodo: las tarjetas de la pantalla y el estado del acumulador de la réplica. */
export interface AuditSummary {
  since: string;
  until: string;
  total: number;
  by_action: AuditActionCount[];
  /** Eventos descartados por falta de memoria en ESA réplica (un hueco en la evidencia): normalmente 0. */
  dropped: number;
  /** Eventos acumulados que el siguiente lote guardará. */
  pending: number;
  retention_days: number;
}

/** Un tramo de la exportación para el auditor (por cursor: `next_cursor` vacío = ya no hay más). */
export interface AuditExport {
  items: AuditEvent[];
  next_cursor: string | null;
  since: string;
  until: string;
}

/** Filtros de la pantalla: los mismos del listado, del resumen y de la exportación. */
export interface AuditFilters {
  since?: string;
  until?: string;
  actor_email?: string;
  action?: string;
  outcome?: string;
  company_id?: number;
  entity_type?: string;
  entity_id?: string;
  search?: string;
}
