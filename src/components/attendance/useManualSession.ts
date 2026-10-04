import { useState } from 'react';
import { useSubmit } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import type { ConfirmInput } from '../../types/confirm';
import { manualServerErrors, validateManual, type ManualErrors, type ManualField, type ManualValues } from './manualSession';

interface ManualRules {
  /** Hoy en la hora del negocio: no se registra un día futuro. */
  today: string;
  /** Al registrar se elige el día; al corregir ya es el de la jornada. */
  withDate: boolean;
}

/** El campo cuyo error se descarta al cambiar un valor ("aún no sale" es parte de la salida). */
const errorFieldOf = (field: keyof ManualValues): ManualField => (field === 'stillWorking' ? 'check_out' : field);

/**
 * Estado del formulario con que la empresa registra o corrige una jornada: valores, errores (los
 * propios se ven al intentar enviar; los del servidor, en su campo hasta que ese campo cambia) y el
 * envío con `useSubmit` ("Guardando…" hasta salir de la pantalla; si falla, el popup lo explica).
 */
export function useManualSession(initial: ManualValues, rules: ManualRules) {
  const [values, setValues] = useState(initial);
  const [server, setServer] = useState<ManualErrors>({});
  const [attempted, setAttempted] = useState(false);
  const { saving, submit } = useSubmit();
  const feedback = useFeedback();
  const client = validateManual(values, rules);

  const set = <K extends keyof ManualValues>(field: K, value: ManualValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServer((current) => ({ ...current, [errorFieldOf(field)]: undefined }));
  };
  const errorOf = (field: ManualField) => server[field] ?? (attempted ? client[field] : undefined);

  /**
   * Envía si lo capturado está completo, tras confirmar (`confirm` arma la pregunta con lo capturado);
   * si no, lo resume en un popup y marca los campos.
   */
  const save = (task: () => Promise<void>, errorTitle: string, confirm: () => ConfirmInput) => {
    setAttempted(true);
    const problems = Object.values(client).filter(Boolean);
    if (problems.length) {
      void feedback.invalidForm(client);
      return;
    }
    void submit(task, errorTitle, { confirm: confirm(), onError: (error) => setServer(manualServerErrors(error)) });
  };

  return {
    values,
    set,
    errors: { work_date: errorOf('work_date'), check_in: errorOf('check_in'), check_out: errorOf('check_out'), breaks: errorOf('breaks'), reason: errorOf('reason') },
    /** Ya se intentó enviar: los campos vacíos se marcan. */
    attempted,
    saving,
    save,
  };
}

export type ManualSessionForm = ReturnType<typeof useManualSession>;
