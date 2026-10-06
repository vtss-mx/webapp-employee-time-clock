import { useState } from 'react';
import { useFormState } from '../../hooks/useFormState';
import { t } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import { shiftService } from '../../services/shiftService';
import type { Shift, ShiftPayload, Weekday } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';
import { formatMinutes } from '../../utils/format';
import { clockLabel, clockOf, weekdaysLabel } from '../../utils/shifts';
import type { FieldErrors } from '../../utils/validation';
import {
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  CHECK_OUT_WINDOW_MAX,
  clockMinutes,
  fitsInADay,
  remoteText,
  SHIFT_NAME_MAX,
  shiftTimeline,
  sortedDays,
  TOLERANCE_MAX,
  validateMinutes,
  validateName,
  type ShiftTimeline,
} from './shiftRules';
import { useShiftPlace } from './useShiftPlace';

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

/** Errores del formulario (solo UX: el backend aplica las mismas reglas), en el idioma activo. */
export function validateShiftForm(values: ShiftFormValues): FieldErrors<ShiftFormValues> {
  const start = clockMinutes(values.start_time);
  const end = clockMinutes(values.end_time);
  const breaks = Number(values.breaks_count);
  const errors: FieldErrors<ShiftFormValues> = {
    name: validateName(values.name, SHIFT_NAME_MAX, t('shifts.form.nameExample')),
    start_time: start === null ? t('shifts.form.errors.startRequired') : undefined,
    end_time: end === null ? t('shifts.form.errors.endRequired') : end === start ? t('shifts.form.errors.endSameAsStart') : undefined,
    break_minutes: breaks > 0 ? validateMinutes(values.break_minutes, BREAK_MINUTES_MIN, BREAK_MINUTES_MAX) : undefined,
  };
  for (const [field, max] of Object.entries(TOLERANCE_LIMITS) as Array<[ToleranceField, number]>) errors[field] = validateMinutes(values[field], 0, max);
  const timeline = timelineOf(values);
  if (timeline && !errors.break_minutes && breaks * Number(values.break_minutes) >= timeline.duration) errors.break_minutes = t('shifts.form.errors.breaksTooLong');
  if (timeline && !fitsInADay(timeline)) errors.late_check_out_minutes ??= t('shifts.form.errors.windowTooLong');
  return errors;
}

/** Sin días en que empieza no hay turno. */
export const weekdaysErrorOf = (weekdays: readonly Weekday[]) => (weekdays.length ? undefined : t('shifts.form.errors.weekdaysRequired'));

/** Dónde se checa con el turno: sus sitios y sus días remotos (ya dentro de sus días). */
export interface PlaceValues {
  siteIds: readonly number[];
  remote: readonly Weekday[];
}

/** Lo que se envía: el turno completo (sin descansos, sus minutos van en 0) con dónde se checa. */
export function shiftPayload(values: ShiftFormValues, weekdays: readonly Weekday[], place: PlaceValues): ShiftPayload {
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
    site_ids: [...place.siteIds].sort((a, b) => a - b),
    remote_weekdays: sortedDays(place.remote),
  };
}

const serverErrors = (err: unknown) => fieldErrorsFrom<ShiftFormValues>(err, { SHIFT_NAME_TAKEN: 'name' });

/**
 * El turno en las confirmaciones, con los nombres de sus campos (alta: lo que se crea; edición: lo que
 * cambia). Los sitios se nombran con `siteName` (los que ya tiene y los que se eligieron).
 */
export const shiftLabels = (siteName: (id: number) => string): FieldLabels<ShiftPayload> => ({
  name: t('shifts.form.fields.name'),
  start_time: { label: t('shifts.form.fields.startTime'), format: clockLabel },
  end_time: { label: t('shifts.form.fields.endTime'), format: clockLabel },
  weekdays: { label: t('shifts.form.fields.weekdays'), format: weekdaysLabel },
  breaks_count: { label: t('shifts.form.fields.breaksCount'), format: (count) => (count === 0 ? t('shifts.breaks.none') : String(count)) },
  break_minutes: { label: t('shifts.form.fields.breakMinutes'), format: formatMinutes },
  early_check_in_minutes: { label: t('shifts.form.fields.earlyCheckIn'), format: formatMinutes },
  late_tolerance_minutes: { label: t('shifts.form.fields.lateTolerance'), format: formatMinutes },
  early_check_out_minutes: { label: t('shifts.form.fields.earlyCheckOut'), format: formatMinutes },
  late_check_out_minutes: { label: t('shifts.form.fields.lateCheckOut'), format: formatMinutes },
  site_ids: { label: t('shifts.form.fields.sites'), format: (ids) => (ids.length ? ids.map(siteName).join(', ') : t('shifts.place.none')) },
  remote_weekdays: { label: t('shifts.form.fields.remoteDays'), format: remoteText },
});

/** "Afecta a 1 empleado asignado" o "Afecta a 8 empleados asignados" (los que lo tienen hoy). */
export const affectsText = (employees: number) => t('shifts.form.affects', { count: employees });

/**
 * Crear: lo que se registra (sin los minutos de descanso si no tiene descansos). Editar: solo lo que
 * cambia y a cuántos afecta (el turno dice dónde y cuándo checan todos los que lo tienen). Se arma al
 * dibujarse la confirmación (en el idioma activo).
 */
export function shiftConfirm(original: Shift | null, payload: ShiftPayload, siteName: (id: number) => string): ConfirmInput {
  const labels = shiftLabels(siteName);
  if (!original) {
    return {
      kind: 'create',
      title: t('shifts.form.confirm.createTitle', { name: payload.name }),
      message: t('shifts.form.confirm.createMessage'),
      detailsTitle: t('shifts.form.confirm.willCreate'),
      details: describeValues({ ...payload, break_minutes: payload.breaks_count ? payload.break_minutes : undefined }, labels),
      confirmLabel: t('shifts.form.create'),
    };
  }
  const before = shiftPayload(initialValues(original), original.weekdays, { siteIds: original.sites.map((site) => site.id), remote: original.remote_weekdays });
  return {
    kind: 'edit',
    title: t('shifts.form.confirm.editTitle', { name: original.name }),
    message: t('shifts.form.confirm.editMessage', { affects: affectsText(original.employees) }),
    changes: describeChanges(before, payload, labels),
    note: t('shifts.form.confirm.editNote'),
  };
}

/**
 * Estado del alta o la edición de un turno: campos, días en que empieza, dónde se checa (sitios y días
 * remotos, `useShiftPlace`), la jornada que resulta (vista previa en vivo) y el guardado. Los errores
 * del servidor vuelven a sus campos.
 */
export function useShiftForm(original: Shift | null) {
  const form = useFormState<ShiftFormValues>(initialValues(original), { serverErrors });
  const [weekdays, setWeekdays] = useState<Weekday[]>(original ? sortedDays(original.weekdays) : WORKWEEK);
  const place = useShiftPlace(original, weekdays);
  const { values } = form;
  const clientErrors = validateShiftForm(values);
  const weekdaysError = weekdaysErrorOf(weekdays);

  const set = (field: keyof ShiftFormValues, value: string) => form.setValues({ ...values, [field]: value });

  const save = (onSaved: (saved: Shift) => void): Promise<void> => {
    form.touchAll();
    place.touch();
    const errors = { ...clientErrors, weekdays: weekdaysError, ...place.clientErrors() };
    if (Object.values(errors).some(Boolean)) {
      // El resumen se vuelve a calcular al dibujarse: abierto, sigue al idioma activo.
      void form.feedback.invalidForm(() => ({ ...validateShiftForm(values), weekdays: weekdaysErrorOf(weekdays), ...place.clientErrors() }));
      return Promise.resolve();
    }
    const payload = shiftPayload(values, weekdays, place);
    return form.save(
      async () => {
        onSaved(await place.watch(original ? shiftService.update(original.id, payload) : shiftService.create(payload)));
      },
      () => t(original ? 'shifts.form.saveError' : 'shifts.form.createError'),
      () => shiftConfirm(original, payload, place.siteName),
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
    place,
    timeline: timelineOf(values),
    saving: form.saving,
    save,
  };
}

export type ShiftForm = ReturnType<typeof useShiftForm>;
