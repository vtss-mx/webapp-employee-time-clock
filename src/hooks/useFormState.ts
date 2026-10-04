import { useCallback, useRef, useState } from 'react';
import type { ConfirmInput } from '../types/confirm';
import { useAction } from './useAction';
import { useFeedback } from './useFeedback';
import type { FieldErrors } from '../utils/validation';

/** Valores del formulario: todos texto (las interfaces no tienen firma de índice). */
type StringValues<T> = { [K in keyof T]: string };

interface FormStateOptions<T extends StringValues<T>> {
  /** Errores de campo del servidor (duplicados, validación) a partir del error de la petición. */
  serverErrors: (error: unknown) => FieldErrors<T>;
  /** Campos que NO se marcan como tocados al cargar valores (p. ej. contraseña vacía = no cambiar). */
  untouchedOnLoad?: Array<keyof T>;
  /**
   * El formulario sigue en pantalla después de guardar (una sección de Mi perfil): el botón se
   * libera al terminar. Por omisión la pantalla se cierra al guardar y sigue "Guardando…" hasta salir.
   */
  staysOpen?: boolean;
}

/**
 * Estado común de los formularios (empleados, empresas):
 * - Cada campo muestra su error al salir de él (o de inmediato si lo marcó el servidor).
 * - Cambiar un campo descarta el error que el servidor había puesto en él.
 * - Guardar: estado de carga, campos marcados y el motivo del error en un popup.
 */
export function useFormState<T extends StringValues<T>>(initial: T, { serverErrors: fromServer, untouchedOnLoad = [], staysOpen = false }: FormStateOptions<T>) {
  const [values, setRawValues] = useState<T>(initial);
  const [serverErrors, setServerErrors] = useState<FieldErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const { busy, run } = useAction();
  const feedback = useFeedback();
  const fields = Object.keys(initial) as Array<keyof T>;

  const setValues = (next: T) => {
    const changed = fields.filter((f) => next[f] !== values[f] && serverErrors[f]);
    setRawValues(next);
    if (changed.length > 0) {
      setServerErrors((current) => {
        const copy = { ...current };
        changed.forEach((f) => delete copy[f]);
        return copy;
      });
    }
  };

  /** Carga valores completos (edición): lo que ya falte o esté mal se ve de inmediato. */
  const untouched = useRef(untouchedOnLoad);
  const loadValues = useCallback((next: T) => {
    setRawValues(next);
    const keys = (Object.keys(next) as Array<keyof T>).filter((f) => !untouched.current.includes(f));
    setTouched(Object.fromEntries(keys.map((f) => [f, true])) as Partial<Record<keyof T, boolean>>);
  }, []);

  const touch = useCallback((field: keyof T) => setTouched((t) => (t[field] ? t : { ...t, [field]: true })), []);
  const touchAll = () => setTouched(Object.fromEntries(fields.map((f) => [f, true])) as Partial<Record<keyof T, boolean>>);

  /** Errores a mostrar: los del servidor; si no, los de la validación en cuanto el campo se tocó. */
  const visibleErrors = (clientErrors: FieldErrors<T>): FieldErrors<T> => {
    const errors: FieldErrors<T> = {};
    for (const field of fields) {
      const message = serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
      if (message) errors[field] = message;
    }
    return errors;
  };

  /**
   * Guarda tras confirmar (`confirm` es obligatoria: guardar un formulario crea o cambia datos;
   * cancelar no envía nada y el formulario sigue igual). Si falla, los errores del servidor quedan en
   * sus campos y el motivo se explica en un popup titulado `title`.
   */
  const save = async (action: () => Promise<void>, title: string, confirm: ConfirmInput): Promise<void> => {
    await run(action, { errorTitle: title, confirm, keepBusy: !staysOpen, onError: (err) => setServerErrors((prev) => ({ ...prev, ...fromServer(err) })) });
  };

  /**
   * Envía si lo capturado es válido (`errors`: las reglas del cliente); si no, marca todos los campos
   * y resume en un popup qué corregir: nada se envía ni se pregunta.
   */
  const saveIfValid = (errors: Record<string, string | undefined>, action: () => Promise<void>, title: string, confirm: () => ConfirmInput): void => {
    touchAll();
    if (Object.values(errors).some(Boolean)) {
      void feedback.invalidForm(errors);
      return;
    }
    void save(action, title, confirm());
  };

  /** Vuelve al formulario inicial (vacío y sin errores), p. ej. tras guardar uno que sigue en pantalla. */
  const reset = () => {
    setRawValues(initial);
    setTouched({});
    setServerErrors({});
  };

  return { values, setValues, loadValues, touch, touchAll, visibleErrors, saving: busy !== null, save, saveIfValid, reset, feedback };
}
