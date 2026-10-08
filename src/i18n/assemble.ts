import type { Dictionary } from './core';

/**
 * Arma el diccionario de un idioma con los espacios de su carpeta: `{ './admin.ts': {...}, './ui.ts': {...} }` →
 * `{ admin: {...}, ui: {...} }`. Cada `locales/<idioma>/index.ts` que no es la fuente (es-MX) lo llama con
 * `import.meta.glob(['./*.ts', '!./index.ts'], { eager: true, import: 'default' })`: así los seis idiomas no repiten la
 * lista de espacios (regla 6 de la raíz), un espacio nuevo entra con solo crear su archivo en cada idioma y el idioma
 * sigue siendo UN archivo diferido (el glob se resuelve al compilar). Cada archivo conserva su tipado
 * (`satisfies Translation<typeof es>` o `derive(es, …)`); que no falte ni sobre un espacio ni una llave lo verifica
 * `dictionaries.test.ts` contra es-MX.
 */
export function assemble(modules: Record<string, object>): Dictionary {
  return Object.fromEntries(Object.entries(modules).map(([path, namespace]) => [path.replace(/^\.\//, '').replace(/\.ts$/, ''), namespace])) as Dictionary;
}
