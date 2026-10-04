import { useCallback, useState } from 'react';
import type { ConfirmInput } from '../types/confirm';
import { useConfirm } from './useConfirm';
import { useFeedback } from './useFeedback';
import { useMountedRef } from './useMountedRef';

/** Popup de éxito: título y detalle opcional. */
export type SuccessNotice = readonly [title: string, detail?: string];

/** Título del popup si falla (el motivo lo explica el error); puede depender del error. */
export type ErrorTitle = string | ((error: unknown) => string);

export interface ActionOptions<R, K> {
  errorTitle: ErrorTitle;
  /** Qué se está procesando (p. ej. el id de la fila): `busy` lo indica mientras dura. Por omisión, `true`. */
  busy?: K;
  /** Popup de éxito; puede depender del resultado (p. ej. el nombre que devolvió el servidor). */
  success?: SuccessNotice | ((result: R) => SuccessNotice);
  /** Al salir bien, antes del aviso: aplicar el resultado, recargar la lista, navegar... */
  onSuccess?: (result: R) => void;
  /** Al fallar, antes del popup: revertir un cambio optimista, marcar el campo, cerrar la confirmación... */
  onError?: (error: unknown) => void;
  /** Al terminar, bien o mal (p. ej. cerrar la confirmación). */
  onSettled?: () => void;
  /**
   * La pantalla se cierra al salir bien (navega o cierra la sesión): sigue ocupada hasta irse, así
   * el botón no se puede volver a pulsar mientras tanto. Solo se libera si falla.
   */
  keepBusy?: boolean;
  /**
   * Pregunta ANTES de enviar (crear, editar, eliminar...; decisión del dueño del producto). Si se
   * cancela no se envía nada, no se marca ocupado, no se llama a ningún callback ni se avisa nada:
   * `run` resuelve false y la pantalla queda como estaba. Es opcional aquí porque `run` también
   * corre acciones que no cambian datos (consultar un estado, elegir los empleados de un filtro);
   * toda acción que crea, cambia o borra la lleva.
   */
  confirm?: ConfirmInput;
}

/**
 * Acción con estado de carga y mensajes (única implementación del bloque "ocupado + try/catch +
 * popup de éxito o del error + liberar"): activar, eliminar, rotar, guardar un ajuste...
 * `busy` dice qué se está procesando (null si nada) para deshabilitar los botones mientras tanto;
 * `run` resuelve true si salió bien.
 */
export function useAction<K = true>() {
  const feedback = useFeedback();
  const confirm = useConfirm();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState<K | null>(null);

  const run = useCallback(
    async <R>(task: () => Promise<R>, options: ActionOptions<R, K>): Promise<boolean> => {
      const { errorTitle, success, onSuccess, onError, onSettled, keepBusy = false } = options;
      if (options.confirm && !(await confirm(options.confirm))) return false;
      setBusy(options.busy ?? (true as K));
      let ok = false;
      try {
        const result = await task();
        onSuccess?.(result);
        const notice = typeof success === 'function' ? success(result) : success;
        if (notice) void feedback.success(...notice);
        ok = true;
      } catch (error) {
        onError?.(error);
        void feedback.fromError(error, { title: typeof errorTitle === 'function' ? errorTitle(error) : errorTitle });
      } finally {
        // Una pantalla que ya se cerró (navegó tras guardar) no se toca.
        if (mounted.current && !(ok && keepBusy)) setBusy(null);
        onSettled?.();
      }
      return ok;
    },
    [feedback, confirm, mounted],
  );

  return { busy, run };
}

/** Opciones del envío de un formulario. */
export interface SubmitOptions {
  /**
   * Pregunta ANTES de enviar (obligatoria: todo formulario crea o cambia datos). Si se cancela, nada
   * se envía y el formulario sigue como estaba.
   */
  confirm: ConfirmInput;
  /** Al fallar, antes del popup (p. ej. marcar el campo con el error del servidor). */
  onError?: (error: unknown) => void;
}

/**
 * Envío de un formulario que se cierra al guardar (alta, edición, motivo, contraseña): primero
 * pregunta (`confirm`); luego "Guardando…" hasta salir de la pantalla; si falla, el error se explica
 * en un popup (`onError` puede además marcar el campo) y el formulario se puede corregir y volver a
 * enviar.
 */
export function useSubmit() {
  const { busy, run } = useAction();
  const submit = useCallback(
    (task: () => Promise<void>, errorTitle: ErrorTitle, { confirm, onError }: SubmitOptions) => run(task, { errorTitle, onError, confirm, keepBusy: true }),
    [run],
  );
  return { saving: busy !== null, submit };
}
