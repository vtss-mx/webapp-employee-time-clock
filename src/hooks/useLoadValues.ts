import { useLayoutEffect, useRef } from 'react';

/**
 * Llena un formulario de edición con los valores de un registro cargado cuando ESOS VALORES cambian, no cuando
 * cambia el objeto que los trae. Al cambiar el idioma la pantalla vuelve a pedir el registro (sus textos del
 * servidor llegan en el idioma nuevo, `useResource`): llega un objeto nuevo con los mismos datos y lo que la
 * persona ya escribió no se pisa (regla 16: en caliente, sin perder nada). Si los datos sí cambiaron (otro
 * registro, "Reintentar" tras un conflicto), el formulario se llena con los nuevos.
 *
 * Se llena antes de pintarse (`useLayoutEffect`): sin parpadeo de campos vacíos. `values` null = aún no llega.
 */
export function useLoadValues<T>(values: T | null, load: (values: T) => void): void {
  const latest = useRef({ values, load });
  useLayoutEffect(() => {
    latest.current = { values, load };
  });
  // Los valores del formulario son texto y banderas: su JSON los compara por contenido.
  const signature = values === null ? null : JSON.stringify(values);
  useLayoutEffect(() => {
    const { values: current, load: fill } = latest.current;
    if (current !== null) fill(current);
  }, [signature]);
}
