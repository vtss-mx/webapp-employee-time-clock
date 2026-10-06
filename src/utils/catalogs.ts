import type { CatalogEntry, CatalogItem, CatalogKey, Catalogs } from '../types';
import { hasKeys, isArrayOf, isRecord } from './guards';

/** Catálogos que la interfaz usa de GET /api/catalogs (las claves de `Catalogs`). */
export const CATALOG_KEYS = [
  'roles',
  'verification_methods',
  'validator_modes',
  'face_statuses',
  'enrollment_statuses',
  'device_statuses',
  'api_scopes',
  'api_key_statuses',
  'error_statuses',
  'error_severities',
  'verification_reasons',
  'accessories',
  'countries',
  'tax_id_types',
  'enrollment_rejection_reasons',
  'reverification_reasons',
  'confidence_levels',
  'antispoof_levels',
  'flash_modes',
  'face_errors',
  'enrollment_flags',
  'work_modes',
  'attendance_actions',
  'work_session_statuses',
  'shift_request_statuses',
  'board_states',
  'assignment_states',
  'day_off_types',
  'attendance_edit_reasons',
  'pricing_modes',
  'price_periods',
  'discount_types',
  'discount_recurrences',
  'billing_statuses',
  'suspension_reasons',
  'charge_statuses',
  'payment_statuses',
  'payment_methods',
  'currencies',
  'storage_categories',
  'slow_alert_statuses',
  'fraud_kinds',
  'signal_modes',
  'review_reasons',
  'risk_tiers',
  'risk_actions',
  'attendance_review_statuses',
  'employee_device_modes',
  'policy_presets',
  'policy_change_statuses',
  'fraud_case_statuses',
  'fraud_case_event_kinds',
  'company_document_types',
] as const satisfies readonly CatalogKey[];

const isItemList = isArrayOf<CatalogItem[]>(hasKeys('code', 'name', 'sort_order', 'active'));

/**
 * Forma de `data` en GET /api/catalogs: cada catálogo que llega es una lista de registros. Uno que el servidor aún
 * no envía se tolera (despliegue gradual: un backend anterior sigue atendiendo mientras se publica la app que ya lo
 * pide); `withMissingCatalogs` lo deja como lista vacía. Uno que llega con otra forma (p. ej. `null`) es inválido.
 */
export function isCatalogs(value: unknown): value is Partial<Catalogs> {
  return isRecord(value) && CATALOG_KEYS.every((key) => value[key] === undefined || isItemList(value[key]));
}

/**
 * Completa con una lista vacía cada catálogo que el servidor aún no envía: la app sigue entrando y lo que dependa de
 * él solo no ofrece opciones hasta que el backend nuevo lo envíe (nunca se rompe la carga de toda la app).
 */
export function withMissingCatalogs(catalogs: Partial<Catalogs>): Catalogs {
  return { ...catalogs, ...Object.fromEntries(CATALOG_KEYS.map((key) => [key, catalogs[key] ?? []])) } as Catalogs;
}

/** Catálogos con búsquedas por código (incluyen inactivos) y las listas de selección (solo activos). */
export interface CatalogApi extends Catalogs {
  /** Registro por código, activo o no (para nombrar registros históricos). */
  byCode: <K extends CatalogKey>(key: K, code: string | null | undefined) => CatalogEntry<K> | undefined;
  /** Nombre del registro; si el catálogo no lo tiene, el código, y sin código, `fallback`. */
  nameOf: (key: CatalogKey, code: string | null | undefined, fallback?: string) => string;
  /** Solo los activos, en el orden del catálogo: lo único que se ofrece para elegir. */
  active: <K extends CatalogKey>(key: K) => Catalogs[K];
}

/** Índices por código y listas de activos, calculados una vez por carga. */
export function createCatalogApi(catalogs: Catalogs): CatalogApi {
  const lists: Record<CatalogKey, readonly CatalogItem[]> = catalogs;
  const perCatalog = <T>(build: (list: readonly CatalogItem[]) => T) =>
    Object.fromEntries(CATALOG_KEYS.map((key) => [key, build(lists[key])])) as Record<CatalogKey, T>;
  const index = perCatalog((list) => new Map(list.map((item) => [item.code, item])));
  const actives = perCatalog((list) => list.filter((item) => item.active));

  const byCode = <K extends CatalogKey>(key: K, code: string | null | undefined) =>
    (code ? index[key].get(code) : undefined) as CatalogEntry<K> | undefined;

  return {
    ...catalogs,
    byCode,
    nameOf: (key, code, fallback = '') => byCode(key, code)?.name ?? (code || fallback),
    active: <K extends CatalogKey>(key: K) => actives[key] as Catalogs[K],
  };
}

/** Registros de un catálogo como opciones de una lista (`Select`): su código, nombre y aclaración. */
export function catalogOptions<Code extends string>(items: ReadonlyArray<CatalogItem<Code>>): Array<{ value: Code; label: string; description?: string }> {
  return items.map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined }));
}
