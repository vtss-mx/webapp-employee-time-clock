import { describe, expect, it } from 'vitest';
import { catalogsFixture } from '../test/catalogs';
import { apiOk, mockFetch } from '../test/http';
import { isCatalogs, withMissingCatalogs } from '../utils/catalogs';
import { catalogService } from './catalogService';

/** Lo que enviaría un backend anterior durante una publicación: aún sin el catálogo de documentos. */
const { company_document_types: _, ...older } = catalogsFixture;

describe('catálogos durante un despliegue gradual', () => {
  it('un catálogo que el servidor aún no envía se tolera y llega como lista vacía; los demás quedan igual', () => {
    expect(isCatalogs(older)).toBe(true);
    const catalogs = withMissingCatalogs(older);
    expect(catalogs.company_document_types).toEqual([]);
    expect(catalogs.roles).toBe(catalogsFixture.roles);
    expect(withMissingCatalogs(catalogsFixture).company_document_types).toBe(catalogsFixture.company_document_types);
  });

  it('GET /api/catalogs de un backend anterior: la app carga sus catálogos con el nuevo vacío', async () => {
    mockFetch(apiOk(older));
    const catalogs = await catalogService.getAll();
    expect(catalogs.company_document_types).toEqual([]);
    expect(catalogs.countries).toEqual(catalogsFixture.countries);
  });
});
