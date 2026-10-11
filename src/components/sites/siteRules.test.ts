import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { SITE_NAME_MAX, sitesLoadError, validateSiteName } from './siteRules';

/**
 * Reglas puras del formulario de un punto de verificación: solo guían a quien captura (el servidor vuelve a validar
 * todo), así que el tope del nombre se revisa aquí aunque el campo también lo limite al escribir.
 */
describe('reglas de un punto de verificación', () => {
  it('el nombre es obligatorio (2 caracteres o más) y no pasa de su tope', () => {
    expect(validateSiteName('  ', 'Planta Hermosillo')).toBe('Escribe el nombre del sitio, p. ej. “Planta Hermosillo”');
    expect(validateSiteName('P', 'Planta Hermosillo')).toBe('Escribe el nombre del sitio, p. ej. “Planta Hermosillo”');
    expect(validateSiteName('P'.repeat(SITE_NAME_MAX + 1), 'Planta Hermosillo')).toBe('A lo más 120 caracteres');
    expect(validateSiteName(' Planta Norte ', 'Planta Hermosillo')).toBeUndefined();
  });

  it('el título del popup cuando no cargan los sitios sigue al idioma activo', async () => {
    expect(sitesLoadError()).toBe('No se pudieron cargar los sitios');
    await setLocale('en-US');
    expect(sitesLoadError()).toBe("Couldn't load the sites");
  });
});
