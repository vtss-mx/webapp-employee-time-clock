import { describe, expect, it } from 'vitest';
import { assemble } from './assemble';
import { LOCALES } from './core';
import esMX from './locales/es-MX';

describe('assemble: el diccionario de un idioma desde los archivos de su carpeta', () => {
  it('nombra cada espacio por su archivo (sin «./» ni «.ts») y conserva su contenido', () => {
    const admin = { shared: { companies: 'Companies' } };
    const ui = { retry: 'Retry' };
    expect(assemble({ './admin.ts': admin, './ui.ts': ui })).toEqual({ admin, ui });
  });

  it('cada idioma que no es la fuente arma exactamente los espacios de es-MX', async () => {
    for (const locale of LOCALES.filter((code) => code !== 'es-MX')) {
      const { default: dictionary } = (await import(`./locales/${locale}/index.ts`)) as { default: object };
      expect(Object.keys(dictionary).sort(), locale).toEqual(Object.keys(esMX).sort());
    }
  });
});
