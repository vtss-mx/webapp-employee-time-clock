import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Catalogs, TaxIdTypeItem } from '../types';
import { createCatalogApi, type CatalogApi } from '../utils/catalogs';

/**
 * Catálogos de prueba: EXACTAMENTE los registros que responde GET /api/catalogs en es-MX, leídos del seed del backend
 * (`alembic/seed/catalogs.json`) como los arma el servidor (`load_catalogs` + `list_catalogs`): cada catálogo en el
 * orden de `sort_order` y código, y `validator_modes` con sus métodos de `validator_mode_methods`. Antes era una copia a
 * mano que derivó del seed (184 textos y 14 registros distintos): leerlo evita que una prueba verifique un texto que el
 * servidor ya no manda. El backend falso (`fakeApi/catalogs.ts`) le pone encima las traducciones de los demás idiomas.
 */
const SEED_FILE = resolve(process.cwd(), '../backend-employee-time-clock/alembic/seed/catalogs.json');
type Row = Record<string, unknown> & { code: string; sort_order: number };
const seed = JSON.parse(readFileSync(SEED_FILE, 'utf-8')) as Record<string, Row[]>;

/** Tablas del seed que no viajan en la respuesta: relaciones, el menú (va con el usuario) y lo que solo usa el servidor. */
const NOT_SERVED = new Set(['validator_mode_methods', 'role_screens', 'menu_module_screens', 'screens', 'menu_modules', 'risk_signals']);
const byOrder = (a: Row, b: Row) => a.sort_order - b.sort_order || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

const methods = new Map<string, string[]>();
for (const link of [...seed.validator_mode_methods].sort(byOrder)) {
  const mode = link.mode_code as string;
  methods.set(mode, [...(methods.get(mode) ?? []), link.method_code as string]);
}

export const catalogsFixture = Object.fromEntries(
  Object.entries(seed)
    .filter(([name]) => !NOT_SERVED.has(name))
    .map(([name, rows]) => [
      name,
      [...rows].sort(byOrder).map((row) => (name === 'validator_modes' ? { ...row, methods: methods.get(row.code) ?? [] } : row)),
    ]),
) as unknown as Catalogs;

/** Los tipos de identificador fiscal del seed (migración 0074), con su regla de formato y su ejemplo. */
export const TAX_ID_TYPES: TaxIdTypeItem[] = catalogsFixture.tax_id_types;

export const testCatalogs: CatalogApi = createCatalogApi(catalogsFixture);

/** Catálogos de prueba con algunos reemplazados (p. ej. una lista vacía o un registro inactivo). */
export const catalogsWith = (changes: Partial<Catalogs>): CatalogApi => createCatalogApi({ ...catalogsFixture, ...changes });
