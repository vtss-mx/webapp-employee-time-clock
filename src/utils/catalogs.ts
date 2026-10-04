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
  'enrollment_rejection_reasons',
  'reverification_reasons',
  'confidence_levels',
  'antispoof_levels',
  'face_errors',
  'enrollment_flags',
] as const satisfies readonly CatalogKey[];

const isItemList = isArrayOf<CatalogItem[]>(hasKeys('code', 'name', 'sort_order', 'active'));

/** Forma de `data` en GET /api/catalogs: cada catálogo es una lista de registros. */
export function isCatalogs(value: unknown): value is Catalogs {
  return isRecord(value) && CATALOG_KEYS.every((key) => isItemList(value[key]));
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
