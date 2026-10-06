import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { defaultRange, rangeErrors, usagePresets, type DayRange } from '../utils/usage';
import { useSyncOnChange } from './useSyncOnChange';

const isValid = (range: DayRange) => !Object.values(rangeErrors(range)).some(Boolean);

/**
 * Rango de días del consumo en la URL (`?start=&end=`: se comparte y sobrevive a recargar; sin ellos,
 * "Este mes", lo mismo que usa el backend por omisión). Las fechas que se escriben a medias o un rango
 * inválido (al revés, de más de 366 días) quedan en el campo con su error y no cambian la consulta;
 * los demás parámetros de la URL (p. ej. `?tab=`) se conservan.
 */
export function useUsagePeriod() {
  const [params, setParams] = useSearchParams();
  const presets = usagePresets();
  const month = defaultRange();
  const fromUrl = { start: params.get('start') ?? '', end: params.get('end') ?? '' };
  const range: DayRange = isValid(fromUrl) ? fromUrl : month;

  // Lo escrito en los campos; un cambio de la URL (rango rápido, regresar) lo reemplaza.
  const [draft, setDraft] = useState(range);
  useSyncOnChange(`${range.start}|${range.end}`, () => setDraft(range));

  const change = (next: DayRange) => {
    setDraft(next);
    if (!isValid(next)) return;
    setParams(
      (current) => {
        const query = new URLSearchParams(current);
        const isMonth = next.start === month.start && next.end === month.end;
        for (const key of ['start', 'end'] as const) {
          if (isMonth) query.delete(key);
          else query.set(key, next[key]);
        }
        return query;
      },
      { replace: true },
    );
  };

  return { range, draft, errors: rangeErrors(draft), change, presets };
}

export type UsagePeriod = ReturnType<typeof useUsagePeriod>;
