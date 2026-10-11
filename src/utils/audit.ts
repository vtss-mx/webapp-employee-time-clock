/**
 * Reglas puras de la bitácora de auditoría (pantalla `ADMIN_AUDIT`): el total con tope, el «antes → después» de
 * `details` y el nombre del archivo de la exportación. Sin React ni peticiones: se prueban solas.
 *
 * Los NOMBRES de las acciones y de los resultados NO viven aquí: salen de los catálogos `audit_actions` y
 * `audit_outcomes` (regla 1 de la raíz). Aquí solo hay presentación.
 */
import { t } from '../i18n';
import type { AuditEvent, AuditFilters } from '../types/audit';
import { isRecord } from './guards';
import { formatCount } from './numbers';


/** Tramos que la exportación pide como máximo: una red de seguridad para no encadenar peticiones sin fin. */
export const AUDIT_EXPORT_MAX_CHUNKS = 200;

/**
 * El total del listado, con su tope: «1,204» o «10,000+». El tope lo ENVÍA el servidor (`count_cap`): la app no
 * tiene una copia de un valor del backend (regla 25 de la raíz). Sin él (un backend anterior) se muestra el total
 * tal cual, que es lo honesto.
 */
export function totalText(total: number, countCap?: number | null): string {
  return countCap && total >= countCap ? `${formatCount(countCap)}+` : formatCount(total);
}

/** Una línea de `details`: un cambio («antes → después») o un dato suelto. */
export type AuditDetail = { key: string } & ({ kind: 'change'; before: unknown; after: unknown } | { kind: 'value'; value: unknown });

/** `{before, after}` es un cambio que el servidor guardó del ORM; cualquier otra cosa es un dato. */
function isChange(value: unknown): value is { before: unknown; after: unknown } {
  return isRecord(value) && 'before' in value && 'after' in value;
}

/**
 * `details` como líneas legibles, en el orden en que el servidor las guardó: un `{before, after}` se dibuja
 * «antes → después» y lo demás como dato. La llave es el nombre técnico de la columna o del campo: es un DATO del
 * servidor y se muestra tal cual (una llave nueva nunca rompe la pantalla ni se oculta).
 */
export function auditDetails(details: Record<string, unknown> | null | undefined): AuditDetail[] {
  if (!details) return [];
  return Object.entries(details).map(([key, value]) =>
    isChange(value) ? { key, kind: 'change', before: value.before, after: value.after } : { key, kind: 'value', value },
  );
}

/** Un valor de `details` como texto: lo vacío y los interruptores con palabras; lo demás, tal cual. */
export function detailText(value: unknown): string {
  if (value === null || value === undefined || value === '') return t('audit.noValue');
  if (typeof value === 'boolean') return t(value ? 'common.values.yes' : 'common.values.no');
  if (typeof value === 'number') return formatCount(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** ¿El listado está filtrado? (el vacío dice «nada coincide» en lugar de «aún no hay eventos»). */
export function isFiltered(filters: AuditFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined && value !== '');
}

/** Nombre del archivo de la exportación, con el periodo que de verdad se exportó (solo la fecha, sin la hora). */
export function auditFileName(since: string, until: string): string {
  const day = (value: string) => value.slice(0, 10);
  return `audit-${day(since)}-${day(until)}.json`;
}

/** Quién hizo la acción: su correo literal o, sin él, que la hizo el sistema. */
export function actorText(event: AuditEvent): string {
  return event.actor_email ?? t('audit.system');
}
