import { assemble } from '../../assemble';

/**
 * Textos de la interfaz en español de España (es-ES): derivados de es-MX con `derive` (`../../derive.ts`), un espacio
 * por archivo con solo lo que cambia (vocabulario de España: «fichar», «móvil», «ordenador»…; glosario
 * `docs/i18n/glosario.md` §3). Así tiene exactamente las mismas llaves y variables que es-MX sin repetir el español común.
 * `assemble` arma el diccionario con los archivos de esta carpeta (uno por espacio; el glob se resuelve al compilar):
 * ningún espacio se lista aquí a mano y `dictionaries.test.ts` verifica que estén todos los de es-MX.
 */
export default assemble(import.meta.glob<object>(['./*.ts', '!./index.ts'], { eager: true, import: 'default' }));
