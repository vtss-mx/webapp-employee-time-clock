import { useCallback, useState } from 'react';
import type { MessageSource } from '../components/MessageDialog';
import type { ConfirmSource } from '../types/confirm';
import { useConfirm } from './useConfirm';
import { useFeedback } from './useFeedback';
import { useMountedRef } from './useMountedRef';

/** Popup de éxito: título y detalle opcional. */
export type SuccessNotice = readonly [title: string, detail?: string];

/**
 * Título del popup si falla (el motivo lo explica el error); puede depender del error. Con una
 * función (`() => t('…')`) se calcula al dibujarse: el popup abierto sigue al idioma activo.
 */
export type ErrorTitle = string | ((error: unknown) => string);

export interface ActionOptions<R, K> {
  errorTitle: ErrorTitle;
  /** Qué se está procesando (p. ej. el id de la fila): `busy` lo indica mientras dura. Por omisión, `true`. */
  busy?: K;
  /**
   * Popup de éxito; puede depender del resultado (p. ej. el nombre que devolvió el servidor). Con una
   * función se arma al dibujarse: el popup abierto sigue al idioma activo.
   */
  success?: SuccessNotice | ((result: R) => SuccessNotice);
  /** Al salir bien, antes del aviso: aplicar el resultado, recargar la lista, navegar... */
  onSuccess?: (result: R) => void;
  /** Al fallar, antes del popup: revertir un cambio optimista, marcar el campo, cerrar la confirmación... */
  onError?: (error: unknown) => void;
  /**
   * Un error que necesita su PROPIO aviso, con su propia acción, EN LUGAR del popup genérico del error: devuelve
   * el mensaje de ese error (o null para que se explique como siempre). Es la forma de cumplir la regla 7 de la
   * raíz cuando un rechazo no se puede reintentar (un límite con `Retry-After`, una sesión que no opera en una
   * empresa): el aviso dice qué hacer y nunca ofrece un «Reintentar» que no podría funcionar. Como el mensaje es
   * una función, el popup abierto sigue al idioma activo.
   */
  errorMessage?: (error: unknown) => MessageSource | null;
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
  confirm?: ConfirmSource;
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
        if (success) {
          void feedback.show(() => {
            const [title, text] = typeof success === 'function' ? success(result) : success;
            return { variant: 'success', title, text };
          });
        }
        ok = true;
      } catch (error) {
        onError?.(error);
        // Un error con su propio aviso lo reemplaza por completo: nunca se abren dos popups por la misma falla.
        const own = options.errorMessage?.(error);
        if (own) void feedback.show(own);
        else void feedback.fromError(error, { title: () => (typeof errorTitle === 'function' ? errorTitle(error) : errorTitle) });
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
  confirm: ConfirmSource;
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
