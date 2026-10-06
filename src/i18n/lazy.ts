/**
 * Textos que se calculan al dibujarse. Un popup o una confirmación abiertos, un error que se muestra
 * o un aviso en pantalla siguen al idioma si reciben una función (`() => t('…')`) en lugar del texto
 * ya traducido: al cambiar el idioma se vuelven a dibujar y la función da el texto nuevo (con sus
 * fechas y números en el formato nuevo). Un texto fijo (string) se muestra tal cual.
 */
import type { ReactNode } from 'react';

/** Un valor ya calculado o la función que lo calcula al dibujarse. */
export type Lazy<T> = T | (() => T);
export type LazyText = Lazy<string>;
export type LazyNode = Lazy<ReactNode>;

/** El valor de un `Lazy`: si es función, se llama ahora (en el idioma activo). */
export function resolveLazy<T>(value: Lazy<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

/**
 * Error del cliente con su texto traducido al leerse (`error.message`): si un popup lo muestra y
 * cambia el idioma, el mensaje cambia con él. Para fallas que arma la app (cámara, ubicación, un
 * archivo inválido...); los mensajes del servidor ya llegan traducidos.
 */
export function localizedError(text: () => string, options?: ErrorOptions & { name?: string }): Error {
  const error = new Error(undefined, options);
  if (options?.name) error.name = options.name;
  Object.defineProperty(error, 'message', { get: text, configurable: true, enumerable: false });
  return error;
}
