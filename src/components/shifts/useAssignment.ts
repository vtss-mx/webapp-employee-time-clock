import { useState } from 'react';
import { useSubmit, type ErrorTitle } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { resolveLazy, t, type LazyText } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { ShiftSummary } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { formatDate } from '../../utils/format';
import { shiftFacts } from './shiftRules';

/** Campos del backend que se marcan en el formulario. */
export type AssignmentErrors = Partial<Record<'valid_from' | 'shift_id', string>>;

interface AssignmentRules {
  /** El turno que va a regir (null mientras no se elige): dice dónde y cuándo se checa. */
  shift: ShiftSummary | null;
  /** Primera fecha permitida (YYYY-MM-DD): hoy, o mañana si ya tiene un turno (un día de anticipación). */
  minDate: string;
  /** Por qué no puede ser antes (se muestra si se elige una fecha anterior); con una función sigue al idioma activo. */
  minMessage: LazyText;
}

/** Errores de lo capturado (solo UX: el backend vuelve a validar todo), en el idioma activo. */
export function assignmentErrors(validFrom: string, { shift, minDate, minMessage }: AssignmentRules): AssignmentErrors {
  let date: string | undefined;
  if (!validFrom) date = t('shifts.assign.errors.dateRequired');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) date = t('ui.dateField.invalid');
  else if (validFrom < minDate) date = resolveLazy(minMessage);
  return { shift_id: shift ? undefined : t('shifts.assign.errors.shiftRequired'), valid_from: date };
}

/**
 * Estado de una asignación (asignar un turno a uno o a varios, aprobar un cambio): solo el turno y
 * desde cuándo, porque el turno ya dice dónde y cuándo se checa. Los errores propios se ven al
 * intentar enviar; los del servidor, en su campo hasta que se cambia ese campo.
 */
export function useAssignment(initialDate: string, rules: AssignmentRules) {
  const [validFrom, setDate] = useState(initialDate);
  const [server, setServer] = useState<AssignmentErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const { saving, submit } = useSubmit();
  const feedback = useFeedback();
  const client = assignmentErrors(validFrom, rules);
  const visible = (field: keyof AssignmentErrors) => server[field] ?? (submitted ? client[field] : undefined);

  /**
   * Envía si lo capturado es válido, tras confirmar: `confirm` recibe el turno elegido y lo que se
   * confirma de la asignación (horario, sitios, días remotos y desde cuándo) para sumarlo a lo suyo
   * (empleados); se llama al dibujarse la confirmación, así sigue al idioma activo (usa `t()` dentro).
   * Si no es válido (también sin turno), lo explica en un popup y marca los campos. Si el servidor lo
   * rechaza, sus errores quedan en sus campos y `onError` puede además reaccionar (salir).
   */
  const send = (task: () => Promise<void>, errorTitle: ErrorTitle, confirm: (shift: ShiftSummary, facts: ConfirmDetail[]) => ConfirmInput, onError?: (err: unknown) => void) => {
    setSubmitted(true);
    const { shift } = rules;
    if (!shift || Object.values(client).some(Boolean)) {
      void feedback.invalidForm(() => assignmentErrors(validFrom, rules));
      return;
    }
    void submit(task, errorTitle, {
      confirm: () => confirm(shift, [...shiftFacts(shift), { label: t('shifts.assign.appliesFrom'), value: formatDate(validFrom) }]),
      onError: (err) => {
        setServer(fieldErrorsFrom<AssignmentErrors>(err));
        onError?.(err);
      },
    });
  };

  return {
    validFrom,
    setValidFrom: (value: string) => {
      setDate(value);
      setServer((current) => ({ ...current, valid_from: undefined }));
    },
    clearShiftError: () => setServer((current) => ({ ...current, shift_id: undefined })),
    errors: { valid_from: visible('valid_from'), shift_id: visible('shift_id') },
    saving,
    send,
  };
}

export type Assignment = ReturnType<typeof useAssignment>;
