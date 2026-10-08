import { describe, expect, it } from 'vitest';
import { describeIssues, languageIssues } from '../test/language';
import { exemptions, renderScreen, screenCases, visibleTexts } from '../test/screenHarness';
import { LOCALES } from './core';

/**
 * Guardián de la regla 16 («nunca se mezclan idiomas»): CADA ruta de CADA pantalla de `SCREEN_VIEWS` (con su menú,
 * sus subpantallas y lo que abre al cargar) se dibuja en es-MX y en en-US con la app completa y un backend falso
 * que responde, como el real, en el idioma de la petición (`src/test/fakeApi`). Se junta todo lo que se ve o se lee
 * (texto, `aria-label`, `title`, `placeholder`, `alt` y el título de la pestaña) y se revisa con cspell en modo
 * estricto (`src/test/language.ts`): en es-MX solo español y en en-US solo inglés, más los nombres propios y siglas
 * de la lista común y la marca «Employee Time Clock». Una palabra desconocida o del otro idioma falla con la
 * pantalla y el texto. Cada pantalla debe cargar con datos reales: una petición sin respuesta en el backend falso
 * también falla (se agrega su ruta en `src/test/fakeApi`).
 */
const CASES = screenCases().map((screen) => [screen.route, screen] as const);

describe.each(LOCALES)('lo que dibuja cada pantalla está solo en %s', (locale) => {
  it.each(CASES)('%s', async (_, screen) => {
    const { backend } = await renderScreen(screen, locale);
    expect([...backend.unhandled], 'peticiones sin ruta en src/test/fakeApi').toEqual([]);
    const issues = await languageIssues(visibleTexts(), locale, exemptions(backend, locale));
    expect(describeIssues(issues)).toEqual([]);
  });
});
