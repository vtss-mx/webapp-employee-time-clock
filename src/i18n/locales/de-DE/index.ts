import { assemble } from '../../assemble';

/**
 * Textos de la interfaz en alemán de Alemania: un espacio por archivo, con las mismas llaves y variables que es-MX.
 * `assemble` arma el diccionario con los archivos de esta carpeta (uno por espacio; el glob se resuelve al compilar):
 * ningún espacio se lista aquí a mano y `dictionaries.test.ts` verifica que estén todos los de es-MX.
 */
export default assemble(import.meta.glob<object>(['./*.ts', '!./index.ts'], { eager: true, import: 'default' }));
