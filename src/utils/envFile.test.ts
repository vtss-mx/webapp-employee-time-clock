import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Toda la configuración base vive en `.env`, completa y a la vista (decisión del dueño del producto).
 * `scripts/generate-env.mjs` imprime el `.env` completo (sin claves); estas pruebas son su guardián: cada
 * variable que lee el código está en la plantilla (y ninguna más), con el valor por defecto del código, y el
 * `.env` local tiene exactamente esas variables. Los mensajes solo nombran variables, nunca un valor.
 */
const ROOT = resolve(__dirname, '../..');
const ENV_FILE = resolve(ROOT, '.env');
const VITE_CONFIG = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');
/** Lo que lee el código: 'VITE_X' en src/utils/config.ts y env.VITE_X en vite.config.ts. */
const READ = [
  ...readFileSync(resolve(__dirname, 'config.ts'), 'utf8').matchAll(/'(VITE_[A-Z0-9_]+)'/g),
  ...VITE_CONFIG.matchAll(/env\.(VITE_[A-Z0-9_]+)/g),
].map((match) => match[1]);
/** Claves de Google: nunca en el repositorio (la plantilla las deja vacías). */
const KEYS = READ.filter((name) => name === 'VITE_GOOGLE_MAPS_API_KEY' || name.startsWith('VITE_FIREBASE_'));

function pairs(text: string): [string, string][] {
  return text.split('\n').flatMap((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    return match ? [[match[1], match[2]] as [string, string]] : [];
  });
}

const template = execFileSync(process.execPath, [resolve(ROOT, 'scripts/generate-env.mjs')], { encoding: 'utf8' });
const values = Object.fromEntries(pairs(template));
const repeated = (names: string[]) => names.filter((name, index) => names.indexOf(name) !== index);

async function configWith(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import('./config')).config;
}

describe('configuración base en .env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('la plantilla tiene cada variable que lee el código, una sola vez, y ninguna más', () => {
    const names = pairs(template).map(([name]) => name);
    expect(repeated(names)).toEqual([]);
    expect(repeated(READ)).toEqual([]);
    expect([...names].sort()).toEqual([...READ].sort());
  });

  it('la plantilla no trae claves de Google Maps ni de Firebase', () => {
    expect(KEYS.length).toBeGreaterThan(1);
    expect(KEYS.filter((name) => values[name] !== '')).toEqual([]);
  });

  it('cada valor de la plantilla es el valor por defecto del código', async () => {
    const defaults = await configWith(Object.fromEntries(READ.map((name) => [name, ''])));
    expect(await configWith(values)).toEqual(defaults);
    // vite.config.ts (solo el servidor de desarrollo)
    expect(values.VITE_DEV_HTTPS).toBe('false');
    expect(VITE_CONFIG).toContain(`env.VITE_PROXY_TARGET || '${values.VITE_PROXY_TARGET}'`);
    expect(values.VITE_ALLOWED_HOSTS).toBe('');
  });

  it.skipIf(!existsSync(ENV_FILE))('el .env local tiene exactamente las variables de la plantilla', () => {
    const names = pairs(readFileSync(ENV_FILE, 'utf8')).map(([name]) => name);
    expect(repeated(names)).toEqual([]);
    expect(READ.filter((name) => !names.includes(name))).toEqual([]); // faltan: agrégalas con su valor por defecto
    expect(names.filter((name) => !READ.includes(name))).toEqual([]); // sobran: nadie las lee
  });
});
