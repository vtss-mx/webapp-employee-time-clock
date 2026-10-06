import { useState } from 'react';
import { t } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { Shift, Weekday } from '../../types';

/** Campos del lugar del turno que el backend puede marcar. */
export type PlaceErrors = Partial<Record<'site_ids' | 'remote_weekdays', string>>;

/** Un sitio elegido con su nombre (para la confirmación). */
export interface PickedSite {
  id: number;
  name: string;
}

/** Algún día del turno se checa en persona: hace falta al menos un sitio (la misma regla del backend). */
export const needsSite = (weekdays: readonly Weekday[], remote: readonly Weekday[]) => weekdays.some((day) => !remote.includes(day));

/** Errores de lo capturado (solo UX: el backend vuelve a validar todo), en el idioma activo. */
export function placeErrors(weekdays: readonly Weekday[], remote: readonly Weekday[], siteIds: readonly number[]): PlaceErrors {
  return { site_ids: needsSite(weekdays, remote) && siteIds.length === 0 ? t('shifts.place.siteRequired') : undefined };
}

/**
 * Dónde se checa con un turno (su alta y su edición): sus sitios y sus días remotos. Los días remotos
 * son siempre días del turno: si se quita un día del turno, deja de ser remoto. El error propio se ve
 * al intentar guardar; los del servidor, en su campo hasta que se cambia ese campo.
 */
export function useShiftPlace(original: Shift | null, weekdays: readonly Weekday[]) {
  const [siteIds, setSiteIds] = useState<number[]>(() => original?.sites.map((site) => site.id) ?? []);
  const [chosenRemote, setChosenRemote] = useState<Weekday[]>(() => original?.remote_weekdays ?? []);
  const [names, setNames] = useState<ReadonlyMap<number, string>>(() => new Map(original?.sites.map((site): [number, string] => [site.id, site.name])));
  const [server, setServer] = useState<PlaceErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const remote = chosenRemote.filter((day) => weekdays.includes(day));
  const client = placeErrors(weekdays, remote, siteIds);

  return {
    siteIds,
    remote,
    /** Los sitios que el turno ya tiene (uno desactivado se muestra para poder quitarlo). */
    current: original?.sites ?? [],
    /** Errores de lo capturado, calculados al usarse (el popup "Revisa la información" abierto sigue al idioma activo). */
    clientErrors: () => placeErrors(weekdays, remote, siteIds),
    errors: { site_ids: server.site_ids ?? (submitted ? client.site_ids : undefined), remote_weekdays: server.remote_weekdays } satisfies PlaceErrors,
    /** Al intentar guardar: desde ahí se ve lo que falta. */
    touch: () => setSubmitted(true),
    setRemote: (days: Weekday[]) => {
      setChosenRemote(days);
      setServer((current) => ({ ...current, remote_weekdays: undefined }));
    },
    setSites: (ids: number[], picked: readonly PickedSite[]) => {
      setSiteIds(ids);
      setNames((known) => new Map([...known, ...picked.map((site): [number, string] => [site.id, site.name])]));
      setServer((current) => ({ ...current, site_ids: undefined }));
    },
    /** Nombre de un sitio para la confirmación (los del turno y los que reporta `SitePicker`). */
    siteName: (id: number) => names.get(id) ?? t('shifts.place.siteFallback', { id }),
    /** Deja en sus campos los errores del servidor sobre el lugar y sigue con el error (su popup). */
    watch: <T>(task: Promise<T>): Promise<T> =>
      task.catch((err: unknown) => {
        setServer(fieldErrorsFrom<PlaceErrors>(err));
        throw err;
      }),
  };
}

export type ShiftPlace = ReturnType<typeof useShiftPlace>;
