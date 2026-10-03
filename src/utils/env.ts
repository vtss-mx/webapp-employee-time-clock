/** Lectura tipada de variables VITE_* con valores por defecto y límites (sin lanzar errores). */

type RawEnv = Record<string, string | boolean | undefined>;

export function envString(env: RawEnv, key: string, fallback: string): string {
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function envNumber(env: RawEnv, key: string, fallback: number, min = -Infinity, max = Infinity): number {
  const raw = env[key];
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Lista de números separados por comas (ordenada, sin repetidos y dentro de los límites). */
export function envNumberList(env: RawEnv, key: string, fallback: number[], min = -Infinity, max = Infinity): number[] {
  const raw = env[key];
  if (typeof raw !== 'string') return fallback;
  const values = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= min && n <= max);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return unique.length ? unique : fallback;
}

export function envBoolean(env: RawEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return fallback;
  if (/^(true|1|yes|on)$/i.test(raw.trim())) return true;
  if (/^(false|0|no|off)$/i.test(raw.trim())) return false;
  return fallback;
}
