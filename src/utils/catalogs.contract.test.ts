import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_KEYS } from './catalogs';

/**
 * Contrato con el backend: la app usa cada catálogo de `CATALOG_KEYS` de GET /api/catalogs. Uno que falta
 * solo se tolera durante un despliegue gradual (llega como lista vacía: `withMissingCatalogs`); si el backend
 * nunca lo enviara, sus listas quedarían vacías para siempre. Si el backend está junto a este proyecto, se
 * compara contra los campos de su esquema `CatalogsRead`: un catálogo nuevo se agrega en los dos lados en el
 * mismo cambio.
 */
const SCHEMA_FILE = resolve(process.cwd(), '../backend-employee-time-clock/app/schemas/catalog.py');

/** Campos `nombre: list[...]` de la clase `CatalogsRead` del backend. */
function servedCatalogs(source: string): string[] {
  const body = source.split('class CatalogsRead(BaseModel):')[1]?.split(/\n(?=\S)/)[0] ?? '';
  return [...body.matchAll(/^\s{4}(\w+): list\[/gm)].map((match) => match[1]);
}

describe('catálogos: contrato con el backend', () => {
  it('lee los campos del esquema', () => {
    expect(servedCatalogs('class CatalogsRead(BaseModel):\n    roles: list[Item]\n    #: nota\n    flash_modes: list[Item]\n\nclass Otro:\n    x: list[Y]')).toEqual(['roles', 'flash_modes']);
    expect(servedCatalogs('sin la clase')).toEqual([]);
  });

  it.skipIf(!existsSync(SCHEMA_FILE))('cada catálogo que la app exige lo envía el backend', () => {
    const served = servedCatalogs(readFileSync(SCHEMA_FILE, 'utf-8'));
    expect(CATALOG_KEYS.filter((key) => !served.includes(key))).toEqual([]);
  });
});
