import { useCallback, useContext, useEffect, useRef } from 'react';
import { ConfirmContext } from '../context/ConfirmContext';
import type { ConfirmSource } from '../types/confirm';

/**
 * Pregunta antes de crear, editar o eliminar (decisión del dueño del producto: nada se crea, cambia
 * ni borra por accidente): `await confirm(() => ({ kind: 'delete', title: t('…') }))` abre el popup
 * personalizable y se resuelve true solo si la persona confirma. Con una función, la confirmación
 * abierta sigue al idioma activo (se arma de nuevo al cambiarlo).
 *
 * - Una edición sin cambios (`changes: []`) no pregunta: avisa "Sin cambios" y resuelve false.
 * - Si la pantalla que preguntó se cierra con el popup abierto (navegó, se desmontó), la
 *   confirmación se retira y resuelve false: nada se envía desde una pantalla que ya no está.
 *
 * Casi nunca se usa directo: `useAction().run(task, { confirm })`, `useSubmit().submit(task, title,
 * { confirm })` y `useFormState().save(task, title, confirm)` ya preguntan antes de enviar.
 */
export function useConfirm(): (input: ConfirmSource) => Promise<boolean> {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('FEEDBACK_PROVIDER_MISSING');
  const { ask, cancel } = context;
  const open = useRef(new Set<number>());

  useEffect(() => {
    const asked = open.current;
    return () => asked.forEach(cancel);
  }, [cancel]);

  return useCallback(
    async (input: ConfirmSource) => {
      const { id, done } = ask(input);
      open.current.add(id);
      const confirmed = await done;
      open.current.delete(id);
      return confirmed;
    },
    [ask],
  );
}
