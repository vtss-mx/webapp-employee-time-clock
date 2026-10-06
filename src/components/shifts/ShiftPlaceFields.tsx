import { useT } from '../../i18n';
import type { Weekday } from '../../types';
import { SitePicker } from './SitePicker';
import { needsSite, type ShiftPlace } from './useShiftPlace';
import { WeekdayPicker } from './WeekdayPicker';

interface ShiftPlaceFieldsProps {
  place: ShiftPlace;
  /** Días del turno: limitan los días remotos. */
  weekdays: readonly Weekday[];
  disabled: boolean;
}

/**
 * "Dónde se checa" de un turno: los sitios donde se checa en persona (obligatorios salvo que todos
 * sus días sean remotos) y los días en que se checa remoto (solo días del turno). Aplica a todos los
 * que tienen el turno: al asignarlo ya no se elige el lugar.
 */
export function ShiftPlaceFields({ place, weekdays, disabled }: ShiftPlaceFieldsProps) {
  const t = useT();
  return (
    <div className="stack">
      <SitePicker
        label={t('shifts.form.place.sitesLabel')}
        value={place.siteIds}
        current={place.current}
        onChange={place.setSites}
        disabled={disabled}
        error={place.errors.site_ids}
        hint={needsSite(weekdays, place.remote) ? t('shifts.form.place.sitesRequired') : t('shifts.form.place.sitesOptional')}
      />
      <WeekdayPicker
        label={t('shifts.form.place.remoteLabel')}
        value={place.remote}
        allowed={weekdays}
        presets={[
          { label: t('shifts.place.none'), days: [] },
          { label: t('shifts.form.place.allItsDays'), days: weekdays },
        ]}
        disabled={disabled}
        error={place.errors.remote_weekdays}
        hint={t('shifts.form.place.remoteHint')}
        onChange={place.setRemote}
      />
    </div>
  );
}
