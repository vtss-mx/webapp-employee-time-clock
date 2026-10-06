import { Landmark } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { t } from '../../i18n';
import { calendarService } from '../../services/calendarService';
import type { Holiday, OfficialHolidaysResult } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDate } from '../../utils/format';
import { deleteNote } from '../trash/TrashParts';
import { useRestore, type RestoreQuestion } from '../trash/useRestore';
import { isStale, longDate } from './calendarRules';

/**
 * Lo que agregó "Agregar festivos oficiales": cada uno con su fecha, o que ya estaban todos. El
 * popup se arma al dibujarse: abierto, sigue al idioma activo (textos y fechas).
 */
function useOfficialNotice() {
  const feedback = useFeedback();
  return ({ added, existing, year }: OfficialHolidaysResult) => {
    if (!added.length) {
      void feedback.info(
        () => t('calendar.holidays.officialDone.allThereTitle'),
        () => t('calendar.holidays.officialDone.allThereText', { existing, year }),
      );
      return;
    }
    void feedback.show(() => ({
      variant: 'success',
      title: t('calendar.holidays.officialDone.added', { count: added.length }),
      text: t('calendar.holidays.officialDone.law', { year }),
      details: added.map((holiday) => `${formatDate(holiday.holiday_date)} · ${holiday.name}`),
      detailsStyle: 'checks',
      footnote: existing ? t('calendar.holidays.officialDone.existing', { count: existing }) : undefined,
    }));
  };
}

/** "Agregar festivos oficiales": qué hará (las fechas las decide el backend con la ley de su año). */
function officialConfirm(year: number): ConfirmInput {
  return {
    kind: 'create',
    icon: <Landmark size={30} />,
    eyebrow: t('calendar.holidays.officialConfirm.eyebrow'),
    title: t('calendar.holidays.officialConfirm.title', { year }),
    message: t('calendar.holidays.officialConfirm.message', { year }),
    details: [t('calendar.holidays.officialConfirm.kept'), t('calendar.holidays.officialConfirm.after')],
    confirmLabel: t('calendar.holidays.officialConfirm.confirm'),
    confirmIcon: <Landmark size={18} />,
  };
}

/** Un festivo en una confirmación: su fecha y su origen. */
const holidayFacts = (holiday: Holiday) => [
  { label: t('common.fields.date'), value: longDate(holiday.holiday_date) },
  { label: t('calendar.holidays.origin'), value: t(holiday.official ? 'calendar.holidays.officialLaw' : 'calendar.holidays.company') },
];

/** Eliminar un festivo: su fecha y su origen; va a «Eliminados» (se restaura durante 1 año). */
function removeConfirm(holiday: Holiday): ConfirmInput {
  return {
    kind: 'delete',
    title: t('calendar.holidays.removeConfirm.title', { name: holiday.name }),
    message: t('calendar.holidays.removeConfirm.message'),
    details: holidayFacts(holiday),
    note: deleteNote(),
  };
}

/** Restaurar un festivo: vuelve a su fecha (ese día deja de ser laborable). */
const restoreQuestion = (holiday: Holiday): RestoreQuestion => ({ title: t('calendar.holidays.restoreTitle', { name: holiday.name }), details: holidayFacts(holiday) });

const officialError = () => t('calendar.holidays.officialConfirm.error');
const removeError = () => t('calendar.holidays.removeConfirm.error');
const removed = (holiday: Holiday) => () =>
  [t('calendar.holidays.removeConfirm.done'), t('calendar.holidays.removeConfirm.doneText', { name: holiday.name, date: formatDate(holiday.holiday_date) })] as const;

/**
 * Las acciones de los festivos (las usan la barra, el detalle del día y la lista del año): agregar los
 * oficiales de un año, eliminar uno y restaurarlo de «Eliminados», cada una con su confirmación; al terminar
 * (o si el festivo ya no existía) `refresh` vuelve a pedir el mes y la lista.
 */
export function useHolidayActions(refresh: () => void) {
  const official = useAction();
  const removal = useAction<number>();
  const restoral = useRestore();
  const officialNotice = useOfficialNotice();

  const addOfficial = (year: number) =>
    void official.run(() => calendarService.addOfficialHolidays(year), {
      // Qué fechas son las decide el backend (la ley y su año): aquí se dice qué hará y, al terminar,
      // el aviso lista cada festivo que agregó.
      confirm: () => officialConfirm(year),
      errorTitle: officialError,
      onSuccess: (result) => {
        refresh();
        officialNotice(result);
      },
    });
  const remove = (holiday: Holiday) =>
    void removal.run(() => calendarService.removeHoliday(holiday.id), {
      busy: holiday.id,
      confirm: () => removeConfirm(holiday),
      errorTitle: removeError,
      success: removed(holiday),
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  const restore = (holiday: Holiday) => void restoral.restore(holiday.id, () => calendarService.restoreHoliday(holiday.id), () => restoreQuestion(holiday), refresh);

  return { addOfficial, adding: official.busy !== null, remove, removing: removal.busy, restore, restoring: restoral.restoring };
}
