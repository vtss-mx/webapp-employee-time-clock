import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import esMX from './locales/es-MX';

/**
 * Guardián de la regla 6 (sin duplicación ni restos): ninguna llave de los diccionarios sobra. Una llave que ningún
 * archivo de `src/` nombra (ni como texto literal `'ns.llave'` ni por una plantilla `` `ns.grupo.${…}` `` que la cubra)
 * es texto muerto en siete idiomas: se elimina, no se traduce. Las plantillas se leen del código: `` `face.stages.${x}.name` ``
 * cubre `face.stages.<cualquiera>.name`; un plural se nombra por su base (`llave`, no `llave_one`).
 */
const SRC = resolve(__dirname, '..');
const PLURAL = /_(zero|one|two|few|many|other)$/;

function sourceFiles(dir: string, into: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!path.includes(`${join('i18n', 'locales')}`)) sourceFiles(path, into);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) into.push(path);
  }
  return into;
}

function leaves(tree: object, prefix = '', into: string[] = []): string[] {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') into.push(path);
    else leaves(value as object, path, into);
  }
  return into;
}

const code = sourceFiles(SRC).map((file) => readFileSync(file, 'utf-8')).join('\n');
/** Cada plantilla del código (`` `ns.grupo.${algo}.resto` ``) como expresión regular sobre la llave completa. */
const templates = [...code.matchAll(/`([a-zA-Z]+(?:\.[a-zA-Z]+)*\.\$\{[^`]*)`/g)].map((match) => {
  const pattern = match[1]
    .split(/\$\{[^}]*\}/)
    .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^.]+');
  return new RegExp(`^${pattern}$`);
});
const named = (key: string) => code.includes(`'${key}'`) || code.includes(`"${key}"`) || code.includes(`\`${key}\``) || templates.some((template) => template.test(key));

describe('diccionarios: ninguna llave sin uso', () => {
  it('cada llave de es-MX la nombra el código (literal o por plantilla)', () => {
    const bases = new Set(leaves(esMX).map((key) => key.replace(PLURAL, '')));
    const unused = [...bases].filter((key) => !named(key));
    expect(unused, 'llaves que nadie usa: se eliminan en los siete idiomas').toEqual([]);
    expect(bases.size).toBeGreaterThan(1000);
  });
});
