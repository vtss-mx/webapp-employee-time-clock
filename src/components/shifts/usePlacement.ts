import { useState } from 'react';
import { useSubmit } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { ShiftRef, Weekday } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { formatDate } from '../../utils/format';
import { weekdaysLabel } from '../../utils/shifts';

/** Desde cuándo, qué días checa remoto y en qué sitios checa en persona (asignar o aprobar un cambio). */
export interface PlacementValues {
  validFrom: string;
  remote: Weekday[];
  siteIds: number[];
}

/** Campos del backend que se marcan en el formulario. */
export type PlacementErrors = Partial<Record<'valid_from' | 'remote_weekdays' | 'site_ids' | 'shift_id', string>>;

interface PlacementRules {
  /** El turno que va a regir (null mientras no se elige). */
  shift: ShiftRef | null;
  /** Primera fecha permitida (YYYY-MM-DD): hoy, o mañana si ya tiene un turno (un día de anticipación). */
  minDate: string;
  /** Por qué no puede ser antes (se muestra si se elige una fecha anterior). */
  minMessage: string;
  /** Se validan y envían los días remotos y los sitios (al aprobar se pueden conservar los actuales). */
  withPlace: boolean;
}

/** Días remotos que el turno sí trabaja (al cambiar de turno, los demás se descartan). */
export const remoteWithin = (remote: readonly Weekday[], shift: ShiftRef | null): Weekday[] => remote.filter((day) => shift?.weekdays.includes(day));

/** Algún día del turno se checa en persona: hace falta al menos un sitio. */
export const needsSite = (shift: ShiftRef | null, remote: readonly Weekday[]) => Boolean(shift?.weekdays.some((day) => !remote.includes(day)));

/** Errores de lo capturado (solo UX: el backend vuelve a validar todo). */
export function placementErrors(values: PlacementValues, { shift, minDate, minMessage, withPlace }: PlacementRules): PlacementErrors {
  const date = values.validFrom;
  let validFrom: string | undefined;
  if (!date) validFrom = 'Elige la fecha desde la que aplica';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) validFrom = 'Escribe una fecha válida (dd/mm/aaaa)';
  else if (date < minDate) validFrom = minMessage;
  return {
    shift_id: shift ? undefined : 'Elige el turno',
    valid_from: validFrom,
    site_ids: withPlace && needsSite(shift, values.remote) && values.siteIds.length === 0 ? 'Elige al menos un sitio donde checar los días que no son remotos' : undefined,
  };
}

/**
 * Estado del formulario de una asignación (asignar un turno o aprobar una solicitud): fecha, días
 * remotos y sitios. Los errores propios se ven al intentar enviar; los del servidor, en su campo
 * hasta que se cambia ese campo.
 */
export function usePlacement(initial: PlacementValues, rules: PlacementRules) {
  const [values, setValues] = useState(initial);
  const [server, setServer] = useState<PlacementErrors>({});
  const [submitted, setSubmitted] = useState(false);
  // Nombres de los sitios elegidos (los da `SitePicker`): la confirmación dice dónde checará.
  const [siteNames, setSiteNames] = useState<string[]>([]);
  const { saving, submit } = useSubmit();
  const feedback = useFeedback();
  const client = placementErrors(values, rules);

  const update = (changes: Partial<PlacementValues>, field: keyof PlacementErrors) => {
    setValues((current) => ({ ...current, ...changes }));
    setServer((current) => ({ ...current, [field]: undefined }));
  };
  const visible = (field: keyof PlacementErrors) => server[field] ?? (submitted ? client[field] : undefined);

  const remote = remoteWithin(values.remote, rules.shift);

  /** Lo que se confirma de la asignación: desde cuándo, qué días remotos y en qué sitios (o que se conservan). */
  const facts = (): ConfirmDetail[] => [
    { label: 'Aplica desde', value: formatDate(values.validFrom) },
    ...(rules.withPlace
      ? [
          { label: 'Días remotos', value: remote.length ? weekdaysLabel(remote) : 'Ninguno' },
          { label: 'Sitios donde checa', value: siteNames.length ? siteNames.join(', ') : 'Ninguno: todos sus días son remotos' },
        ]
      : ['Conserva sus días remotos y sus sitios actuales.']),
  ];

  /**
   * Envía si lo capturado es válido, tras confirmar: `confirm` recibe el turno elegido y lo que se
   * confirma de la asignación (fecha, días remotos y sitios) para sumarlo a lo suyo (empleados). Si no
   * es válido (también sin turno), lo explica en un popup y marca los campos. Si el servidor lo
   * rechaza, sus errores quedan en sus campos y `onError` puede además reaccionar (p. ej. salir).
   */
  const send = (task: () => Promise<void>, errorTitle: string, confirm: (shift: ShiftRef, place: ConfirmDetail[]) => ConfirmInput, onError?: (err: unknown) => void) => {
    setSubmitted(true);
    const { shift } = rules;
    if (!shift || Object.values(client).some(Boolean)) {
      void feedback.invalidForm(client);
      return;
    }
    void submit(task, errorTitle, {
      confirm: confirm(shift, facts()),
      onError: (err) => {
        setServer(fieldErrorsFrom<PlacementErrors>(err));
        onError?.(err);
      },
    });
  };

  return {
    values,
    /** Días remotos que se envían: solo los que el turno trabaja. */
    remote,
    setValidFrom: (validFrom: string) => update({ validFrom }, 'valid_from'),
    setRemote: (remote: Weekday[]) => update({ remote }, 'remote_weekdays'),
    setSiteIds: (siteIds: number[], names: string[]) => {
      update({ siteIds }, 'site_ids');
      setSiteNames(names);
    },
    clearShiftError: () => setServer((current) => ({ ...current, shift_id: undefined })),
    errors: { valid_from: visible('valid_from'), remote_weekdays: visible('remote_weekdays'), site_ids: visible('site_ids'), shift_id: visible('shift_id') },
    saving,
    send,
  };
}

export type Placement = ReturnType<typeof usePlacement>;
