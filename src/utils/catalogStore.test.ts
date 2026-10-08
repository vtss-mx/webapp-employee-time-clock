import { describe, expect, it, vi } from 'vitest';
import { catalogsFixture } from '../test/catalogs';
import { countryDirectory } from './phone';
import { createCatalogApi, latestCatalogs, publishCatalogs, subscribeCatalogs } from './catalogs';

/**
 * Catálogos VIGENTES (regla 16, en caliente): como `t()`, `byCode`, `nameOf` y `active` buscan siempre en los
 * catálogos del idioma activo, también los de una carga anterior que guardó una función (un popup abierto).
 */
const english = { ...catalogsFixture, roles: catalogsFixture.roles.map((role) => ({ ...role, name: role.code === 'ADMIN' ? 'Administrator' : role.name, active: role.code !== 'VALIDATOR' })) };

describe('catálogos vigentes', () => {
  it('una carga anterior nombra con los vigentes; sin vigentes, con los suyos', () => {
    const spanish = createCatalogApi(catalogsFixture);
    expect(spanish.nameOf('roles', 'ADMIN')).toBe('Administrador');
    const listener = vi.fn();
    const unsubscribe = subscribeCatalogs(listener);
    const current = createCatalogApi(english);
    publishCatalogs(current);
    expect(latestCatalogs()).toBe(current);
    expect(listener).toHaveBeenCalledOnce();
    expect(spanish.nameOf('roles', 'ADMIN')).toBe('Administrator'); // la guardó un popup abierto: ya en inglés
    expect(spanish.byCode('roles', null)).toBeUndefined();
    expect(spanish.active('roles').map((role) => role.code)).not.toContain('VALIDATOR');
    publishCatalogs(current); // los mismos: no avisa otra vez
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    publishCatalogs(null);
    expect(listener).toHaveBeenCalledOnce();
    expect(spanish.nameOf('roles', 'ADMIN')).toBe('Administrador');
    expect(spanish.nameOf('roles', 'GONE')).toBe('GONE');
    expect(spanish.nameOf('roles', null, '—')).toBe('—');
  });

  it('un teléfono guarda el país elegido y lo nombra con el catálogo vigente; uno que ya no está, tal cual', () => {
    const spanishCountries = countryDirectory(catalogsFixture.countries);
    // El catálogo en inglés, sin Japón: un país que una empresa ya no tiene se nombra tal cual.
    const englishCountries = countryDirectory(
      catalogsFixture.countries.filter((country) => country.code !== 'JP').map((country) => (country.code === 'MX' ? { ...country, name: 'Mexico' } : country)),
    );
    const chosen = spanishCountries.split('+526621234567').country;
    expect(chosen.name).toBe('México');
    expect(englishCountries.current(chosen).name).toBe('Mexico');
    const gone = { ...chosen, code: 'JP' as const };
    expect(englishCountries.current(gone)).toBe(gone);
  });
});
