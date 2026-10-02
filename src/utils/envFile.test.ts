import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `frontend/.env`: el único archivo de configuración del frontend. */
const ENV_FILE = resolve(__dirname, '../../.env');
const READERS = ['config.ts', '../../vite.config.ts'].map((path) => readFileSync(resolve(__dirname, path), 'utf8'));

describe('frontend/.env', () => {
  it.skipIf(!existsSync(ENV_FILE))('solo variables VITE_* con valor, que el código lee y sin repetir', () => {
    const lines = readFileSync(ENV_FILE, 'utf8').split('\n');
    const keys = lines.flatMap((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1] ?? []);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => !key.startsWith('VITE_'))).toEqual([]);
    expect(lines.filter((line) => /^[A-Z][A-Z0-9_]*=\s*$/.test(line))).toEqual([]);
    // La lee src/utils/config.ts ('VITE_X') o vite.config.ts (env.VITE_X).
    expect(keys.filter((key) => !READERS.some((code) => code.includes(`'${key}'`) || code.includes(`env.${key}`)))).toEqual([]);
  });
});
