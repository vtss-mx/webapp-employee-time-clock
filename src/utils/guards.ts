/**
 * Validadores de forma (type guards) para `data` de las respuestas de la API.
 * Son deliberadamente laxos: comprueban solo lo que la UI necesita para no fallar en tiempo
 * de ejecución si el servidor (o un proxy) devuelve algo inesperado.
 */

export type Guard<T> = (value: unknown) => value is T;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Objeto con las claves indicadas (con cualquier valor). */
export function hasKeys<T>(...keys: string[]): Guard<T> {
  return (value: unknown): value is T => isRecord(value) && keys.every((key) => key in value);
}

/** Página de resultados `{ items: [], total: number }`. */
export function isPage<T>(itemGuard?: Guard<unknown>): Guard<T> {
  return (value: unknown): value is T =>
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.total === 'number' &&
    (!itemGuard || value.items.every(itemGuard));
}

export function isArrayOf<T>(itemGuard: Guard<unknown>): Guard<T> {
  return (value: unknown): value is T => Array.isArray(value) && value.every(itemGuard);
}

/** Respuestas sin datos (`data: null`). */
export const isNothing = (value: unknown): value is null | undefined => value === null || value === undefined;
