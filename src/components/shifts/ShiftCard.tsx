import { CalendarClock, Moon } from 'lucide-react';
import { useT } from '../../i18n';
import type { Shift, ShiftSummary } from '../../types';
import { shiftSchedule, weekdaysLabel } from '../../utils/shifts';
import { breaksText } from './shiftRules';
import { SitePlaces } from './SitePlaces';

/**
 * Tarjeta compacta de un turno: cuándo (horario, días y, si se conocen, descansos) y dónde se checa
 * (sus sitios y sus días remotos). Al asignar un turno o aprobar un cambio se ve todo lo que implica
 * elegirlo: el lugar es el del turno, no se captura otra vez.
 */
export function ShiftCard({ shift }: { shift: ShiftSummary | Shift }) {
  const t = useT();
  const when = [shiftSchedule(shift), weekdaysLabel(shift.weekdays)];
  if ('breaks_count' in shift) when.push(breaksText(shift.breaks_count, shift.break_minutes));
  const remote = shift.remote_weekdays.length ? { title: t('shifts.card.remote', { days: weekdaysLabel(shift.remote_weekdays) }), detail: t('shifts.card.remoteDetail') } : null;
  return (
    <div className="shift-summary" aria-label={t('shifts.card.label', { name: shift.name })} role="group">
      <div className="shift-summary__head">
        <span className="icon-tile">{shift.overnight ? <Moon size={18} aria-hidden /> : <CalendarClock size={18} aria-hidden />}</span>
        <strong>{shift.name}</strong>
        <span className="muted">{when.join(' · ')}</span>
      </div>
      <SitePlaces sites={shift.sites} remote={remote} />
    </div>
  );
}
