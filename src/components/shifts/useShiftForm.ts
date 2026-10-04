import { useState } from 'react';
import { useFormState } from '../../hooks/useFormState';
import { fieldErrorsFrom } from '../../services/apiClient';
import { shiftService } from '../../services/shiftService';
import type { Shift, ShiftPayload, Weekday } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';
import { formatMinutes } from '../../utils/format';
import { clockOf, weekdaysLabel } from '../../utils/shifts';
import type { FieldErrors } from '../../utils/validation';
import {
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  CHECK_OUT_WINDOW_MAX,
  clockMinutes,
  fitsInADay,
  SHIFT_NAME_MAX,
  shiftTimeline,
  sortedDays,
  TOLERANCE_MAX,
  validateMinutes,
  validateName,
  type ShiftTimeline,
} from './shiftRules';

/** Valores del formulario (texto, como los captura cada campo); los días van aparte. */
export type ShiftFormValues = {
  name: string;
  start_time: string;
  end_time: string;
  breaks_count: string;
  break_minutes: string;
  early_check_in_minutes: string;
  late_tolerance_minutes: string;
  early_check_out_minutes: string;
  late_check_out_minutes: string;
};

type ToleranceField = 'early_check_in_minutes' | 'late_tolerance_minutes' | 'early_check_out_minutes' | 'late_check_out_minutes';

/** Máximo de cada tolerancia (los mismos que el backend; el mínimo es 0). */
export const TOLERANCE_LIMITS: Record<ToleranceField, number> = {
  early_check_in_minutes: TOLERANCE_MAX,
  late_tolerance_minutes: TOLERANCE_MAX,
  early_check_out_minutes: TOLERANCE_MAX,
  late_check_out_minutes: CHECK_OUT_WINDOW_MAX,
};

/** Un turno nuevo: de lunes a viernes, de 08:00 a 16:00 y las tolerancias por omisión del backend. */
const NEW_SHIFT: ShiftFormValues = {
  name: '',
  start_time: '08:00',
  end_time: '16:00',
  breaks_count: '0',
  break_minutes: '30',
  early_check_in_minutes: '15',
  late_tolerance_minutes: '10',
  early_check_out_minutes: '0',
  late_check_out_minutes: '60',
};
export const WORKWEEK: Weekday[] = [0, 1, 2, 3, 4];
const DEFAULT_BREAK_MINUTES = 30;

function initialValues(shift: Shift | null): ShiftFormValues {
  if (!shift) return NEW_SHIFT;
  return {
    name: shift.name,
    start_time: clockOf(shift.start_time),
    end_time: clockOf(shift.end_time),
    breaks_count: String(shift.breaks_count),
    break_minutes: String(shift.break_minutes || DEFAULT_BREAK_MINUTES),
    early_check_in_minutes: String(shift.early_check_in_minutes),
    late_tolerance_minutes: String(shift.late_tolerance_minutes),
    early_check_out_minutes: String(shift.early_check_out_minutes),
    late_check_out_minutes: String(shift.late_check_out_minutes),
  };
}

/** Minutos escritos (para la vista previa: lo que aún no es un número cuenta como 0). */
const minutes = (value: string) => Number(value) || 0;

/** La jornada que resulta de lo capturado; null mientras la entrada y la salida no sean válidas y distintas. */
export function timelineOf(values: ShiftFormValues): ShiftTimeline | null {
  const start = clockMinutes(values.start_time);
  const end = clockMinutes(values.end_time);
  if (start === null || end === null || start === end) return null;
  return shiftTimeline({
    start,
    end,
    breaksCount: minutes(values.breaks_count),
    breakMinutes: minutes(values.break_minutes),
    earlyCheckIn: minutes(values.early_check_in_minutes),
    lateTolerance: minutes(values.late_tolerance_minutes),
    earlyCheckOut: minutes(values.early_check_out_minutes),
    lateCheckOut: minutes(values.late_check_out_minutes),
  });
}

/** Errores del formulario (solo UX: el backend aplica las mismas reglas). */
export function validateShiftForm(values: ShiftFormValues): FieldErrors<ShiftFormValues> {
  const start = clockMinutes(values.start_time);
  const end = clockMinutes(values.end_time);
  const breaks = Number(values.breaks_count);
  const errors: FieldErrors<ShiftFormValues> = {
    name: validateName(values.name, SHIFT_NAME_MAX, 'Matutino'),
    start_time: start === null ? 'Indica la hora de entrada' : undefined,
    end_time: end === null ? 'Indica la hora de salida' : end === start ? 'La salida debe ser distinta de la entrada' : undefined,
    break_minutes: breaks > 0 ? validateMinutes(values.break_minutes, BREAK_MINUTES_MIN, BREAK_MINUTES_MAX) : undefined,
  };
  for (const [field, max] of Object.entries(TOLERANCE_LIMITS) as Array<[ToleranceField, number]>) errors[field] = validateMinutes(values[field], 0, max);
  const timeline = timelineOf(values);
  if (timeline && !errors.break_minutes && breaks * Number(values.break_minutes) >= timeline.duration) errors.break_minutes = 'Los descansos no pueden sumar todo el turno';
  if (timeline && !fitsInADay(timeline)) errors.late_check_out_minutes ??= 'La entrada temprana, el turno y el límite de salida deben sumar menos de 24 horas';
  return errors;
}

/** Lo que se envía: el turno completo (sin descansos, sus minutos van en 0). */
export function shiftPayload(values: ShiftFormValues, weekdays: readonly Weekday[]): ShiftPayload {
  const breaks = Number(values.breaks_count);
  return {
    name: values.name.trim(),
    start_time: values.start_time,
    end_time: values.end_time,
    weekdays: sortedDays(weekdays),
    breaks_count: breaks,
    break_minutes: breaks > 0 ? Number(values.break_minutes) : 0,
    early_check_in_minutes: Number(values.early_check_in_minutes),
    late_tolerance_minutes: Number(values.late_tolerance_minutes),
    early_check_out_minutes: Number(values.early_check_out_minutes),
    late_check_out_minutes: Number(values.late_check_out_minutes),
  };
}

const serverErrors = (err: unknown) => fieldErrorsFrom<ShiftFormValues>(err, { SHIFT_NAME_TAKEN: 'name' });

/** El turno en las confirmaciones, con los nombres de sus campos (alta: lo que se crea; edición: lo que cambia). */
export const SHIFT_LABELS: FieldLabels<ShiftPayload> = {
  name: 'Nombre del turno',
  start_time: 'Hora de entrada',
  end_time: 'Hora de salida',
  weekdays: { label: 'Días en que empieza', format: weekdaysLabel },
  breaks_count: { label: 'Descansos por jornada', format: (count) => (count === 0 ? 'Sin descansos' : String(count)) },
  break_minutes: { label: 'Minutos de cada descanso', format: formatMinutes },
  early_check_in_minutes: { label: 'Checar antes de la entrada', format: formatMinutes },
  late_tolerance_minutes: { label: 'Retardo tolerado', format: formatMinutes },
  early_check_out_minutes: { label: 'Salida anticipada tolerada', format: formatMinutes },
  late_check_out_minutes: { label: 'Límite para checar la salida', format: formatMinutes },
};

/** Crear: lo que se registra (sin los minutos de descanso si no tiene descansos). Editar: solo lo que cambia. */
export function shiftConfirm(original: Shift | null, payload: ShiftPayload): ConfirmInput {
  if (!original) {
    return {
      kind: 'create',
      title: `¿Crear el turno ${payload.name}?`,
      message: 'Se podrá asignar a tus empleados y elegir en las solicitudes de cambio.',
      detailsTitle: 'Se creará',
      details: describeValues({ ...payload, break_minutes: payload.breaks_count ? payload.break_minutes : undefined }, SHIFT_LABELS),
      confirmLabel: 'Crear turno',
    };
  }
  return {
    kind: 'edit',
    title: `¿Guardar los cambios del turno ${original.name}?`,
    changes: describeChanges(shiftPayload(initialValues(original), original.weekdays), payload, SHIFT_LABELS),
    note: 'Los cambios aplican a las jornadas que aún no empiezan: lo ya registrado conserva su horario.',
  };
}

/**
 * Estado del alta o la edición de un turno: campos, días en que empieza, la jornada que resulta
 * (vista previa en vivo) y el guardado. Los errores del servidor vuelven a sus campos.
 */
export function useShiftForm(original: Shift | null) {
  const form = useFormState<ShiftFormValues>(initialValues(original), { serverErrors });
  const [weekdays, setWeekdays] = useState<Weekday[]>(original ? sortedDays(original.weekdays) : WORKWEEK);
  const { values } = form;
  const clientErrors = validateShiftForm(values);
  const weekdaysError = weekdays.length ? undefined : 'Elige al menos un día en que empieza el turno';

  const set = (field: keyof ShiftFormValues, value: string) => form.setValues({ ...values, [field]: value });

  const save = (onSaved: (saved: Shift) => void): Promise<void> => {
    form.touchAll();
    if (weekdaysError || Object.values(clientErrors).some(Boolean)) {
      void form.feedback.invalidForm({ ...clientErrors, weekdays: weekdaysError });
      return Promise.resolve();
    }
    const payload = shiftPayload(values, weekdays);
    return form.save(
      async () => {
        onSaved(original ? await shiftService.update(original.id, payload) : await shiftService.create(payload));
      },
      original ? 'No se pudo guardar el turno' : 'No se pudo crear el turno',
      shiftConfirm(original, payload),
    );
  };

  return {
    values,
    set,
    touch: form.touch,
    errors: form.visibleErrors(clientErrors),
    weekdays,
    setWeekdays,
    weekdaysError,
    timeline: timelineOf(values),
    saving: form.saving,
    save,
  };
}

export type ShiftForm = ReturnType<typeof useShiftForm>;
