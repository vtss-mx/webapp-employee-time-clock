import { useCallback, useState } from 'react';
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
}

/**
 * Acción con estado de carga y mensajes (única implementación del bloque "ocupado + try/catch +
 * popup de éxito o del error + liberar"): activar, eliminar, rotar, guardar un ajuste...
 * `busy` dice qué se está procesando (null si nada) para deshabilitar los botones mientras tanto;
 * `run` resuelve true si salió bien.
 */
export function useAction<K = true>() {
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState<K | null>(null);

  const run = useCallback(
    async <R>(task: () => Promise<R>, options: ActionOptions<R, K>): Promise<boolean> => {
      const { errorTitle, success, onSuccess, onError, onSettled, keepBusy = false } = options;
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
    [feedback, mounted],
  );

  return { busy, run };
}

/**
 * Envío de un formulario que se cierra al guardar (alta, edición, motivo, contraseña): "Guardando…"
 * hasta salir de la pantalla; si falla, el error se explica en un popup (`onError` puede además
 * marcar el campo) y el formulario se puede corregir y volver a enviar.
 */
export function useSubmit() {
  const { busy, run } = useAction();
  const submit = useCallback(
    (task: () => Promise<void>, errorTitle: ErrorTitle, onError?: (error: unknown) => void) =>
      run(task, { errorTitle, onError, keepBusy: true }),
    [run],
  );
  return { saving: busy !== null, submit };
}
