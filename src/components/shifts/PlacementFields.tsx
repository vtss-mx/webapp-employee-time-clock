import type { ReactNode } from 'react';
import type { ShiftRef } from '../../types';
import { DateField } from '../ui/DateField';
import { SitePicker } from './SitePicker';
import { needsSite, type Placement } from './usePlacement';
import { WeekdayPicker } from './WeekdayPicker';

interface PlacementFieldsProps {
  placement: Placement;
  /** El turno que va a regir: sus días limitan los días remotos (null mientras no se elige). */
  shift: ShiftRef | null;
  minDate: string;
  dateHint: string;
  /** Mostrar días remotos y sitios (al aprobar se pueden conservar los actuales). */
  withPlace: boolean;
  /** Lo que va entre la fecha y el lugar (p. ej. "Conservar días remotos y sitios"). */
  children?: ReactNode;
}

/** Por qué se piden los sitios (o por qué no hacen falta). */
function sitesHint(shift: ShiftRef | null, placement: Placement): string {
  if (!shift) return 'Elige primero el turno: los sitios son obligatorios si algún día no es remoto.';
  return needsSite(shift, placement.remote) ? 'Obligatorio: los días que no son remotos checa a no más del radio de alguno de estos sitios.' : 'Opcional: todos los días del turno son remotos.';
}

/**
 * Fecha desde la que aplica el turno, días en que puede checar remoto (solo días del turno) y
 * sitios donde checa en persona (obligatorios salvo que todos los días del turno sean remotos).
 */
export function PlacementFields({ placement, shift, minDate, dateHint, withPlace, children }: PlacementFieldsProps) {
  const { values, errors, saving } = placement;
  const allowed = shift?.weekdays ?? [];
  return (
    <div className="stack">
      <DateField label="Aplica desde" required value={values.validFrom} min={minDate} openTo={minDate} disabled={saving} error={errors.valid_from} hint={dateHint} onChange={placement.setValidFrom} />
      {children}
      {withPlace && (
        <>
          <WeekdayPicker
            label="Días en que checa remoto"
            value={placement.remote}
            allowed={allowed}
            presets={[
              { label: 'Ninguno', days: [] },
              { label: 'Todos sus días', days: allowed },
            ]}
            disabled={saving || !shift}
            error={errors.remote_weekdays}
            hint="Esos días puede checar desde cualquier lugar (con su rostro y su ubicación); los demás, en uno de sus sitios."
            onChange={placement.setRemote}
          />
          <SitePicker
            label="Sitios donde checa en persona"
            value={values.siteIds}
            onChange={placement.setSiteIds}
            disabled={saving}
            error={errors.site_ids}
            hint={sitesHint(shift, placement)}
          />
        </>
      )}
    </div>
  );
}
