import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { shiftService } from '../../services/shiftService';
import { siteService } from '../../services/siteService';
import type { Shift, WorkSite } from '../../types';
import { addressLine } from '../../utils/address';
import { shiftSchedule, weekdaysLabel } from '../../utils/shifts';
import { DeletedRecordPage } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';
import { metersText, shiftFacts } from './shiftRules';

/** Restaurar un sitio: cuál regresa (su domicilio y su radio). */
export const siteRestore = (site: WorkSite): RestoreQuestion => ({
  title: t('sites.trash.restoreTitle', { name: site.name }),
  details: [
    { label: t('sites.list.columns.address'), value: addressLine(site.address) },
    { label: t('sites.list.columns.radius'), value: metersText(site.radius_m) },
  ],
});

/** Restaurar un turno: cuál regresa (su horario, sus sitios y sus días remotos). */
export const shiftRestore = (shift: Shift): RestoreQuestion => ({
  title: t('shifts.trash.restoreTitle', { name: shift.name }),
  details: shiftFacts(shift),
});

interface DeletedProps<T> {
  record: T;
  /** Al restaurarlo: la pantalla muestra su edición vigente. */
  onRestored: (record: T) => void;
}

/**
 * Un sitio eliminado (su edición es su detalle): el aviso con cuándo y quién lo eliminó, y «Restaurar»; sin el
 * formulario, el estado ni eliminar.
 */
export function DeletedSite({ record: site, onRestored }: DeletedProps<WorkSite>) {
  const t = useT();
  return (
    <DeletedRecordPage
      record={site}
      name={site.name}
      subtitle={addressLine(site.address)}
      backTo={paths.company.sites}
      backLabel={t('sites.list.title')}
      banner={t('sites.trash.banner')}
      restore={() => siteService.restore(site.id)}
      question={() => siteRestore(site)}
      onRestored={onRestored}
    />
  );
}

/**
 * Un turno eliminado (su edición es su detalle): el aviso con cuándo y quién lo eliminó, y «Restaurar»; sin el
 * formulario, asignarlo, el estado ni eliminar.
 */
export function DeletedShift({ record: shift, onRestored }: DeletedProps<Shift>) {
  const t = useT();
  return (
    <DeletedRecordPage
      record={shift}
      name={shift.name}
      subtitle={`${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}`}
      backTo={paths.company.shifts}
      backLabel={t('shifts.list.title')}
      banner={t('shifts.trash.banner')}
      restore={() => shiftService.restore(shift.id)}
      question={() => shiftRestore(shift)}
      onRestored={onRestored}
    />
  );
}
