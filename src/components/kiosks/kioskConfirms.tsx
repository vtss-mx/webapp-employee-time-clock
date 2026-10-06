import { KeyRound, Tablet } from 'lucide-react';
import { t } from '../../i18n';
import type { Kiosk } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { deleteNote } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';

/*
 * Confirmaciones de los kioscos de un sitio (se arman al dibujarse: una confirmación abierta sigue al idioma activo).
 * Crear dice qué se crea; un código nuevo, que la tableta vinculada deja de funcionar; eliminar, qué deja de pasar.
 */

/** Estado de vinculación como un hecho: «Vinculado» o «Sin vincular». */
export const pairedText = (kiosk: Pick<Kiosk, 'paired'>) => t(kiosk.paired ? 'kiosk.manage.paired' : 'kiosk.manage.unpaired');

/** El sitio y la tableta vinculada (si hay). */
function kioskDetails(kiosk: Kiosk, siteName: string): ConfirmDetail[] {
  return [
    { label: t('kiosk.manage.site'), value: siteName },
    { label: t('kiosk.manage.tablet'), value: (kiosk.paired && kiosk.device_name) || pairedText(kiosk) },
  ];
}

export function createKioskConfirm(name: string, siteName: string): ConfirmInput {
  return {
    kind: 'create',
    icon: <Tablet size={30} />,
    title: t('kiosk.manage.createTitle', { name }),
    message: t('kiosk.manage.createMessage'),
    detailsTitle: t('kiosk.manage.willCreate'),
    details: [
      { label: t('kiosk.manage.site'), value: siteName },
      { label: t('common.fields.name'), value: name },
    ],
    confirmLabel: t('kiosk.manage.create'),
    confirmIcon: <Tablet size={18} />,
  };
}

export function repairKioskConfirm(kiosk: Kiosk, siteName: string): ConfirmInput {
  return {
    kind: 'action',
    tone: 'warning',
    icon: <KeyRound size={30} />,
    title: t('kiosk.manage.repairTitle', { name: kiosk.name }),
    message: t('kiosk.manage.repairMessage'),
    details: kioskDetails(kiosk, siteName),
    note: kiosk.paired ? t('kiosk.manage.repairNote') : undefined,
    confirmLabel: t('kiosk.manage.repair'),
    confirmIcon: <KeyRound size={18} />,
  };
}

export function deleteKioskConfirm(kiosk: Kiosk, siteName: string): ConfirmInput {
  return {
    kind: 'delete',
    title: t('kiosk.manage.deleteTitle', { name: kiosk.name }),
    message: t('kiosk.manage.deleteMessage'),
    details: kioskDetails(kiosk, siteName),
    note: deleteNote(),
  };
}

export const kioskRestore = (kiosk: Kiosk, siteName: string): RestoreQuestion => ({
  title: t('kiosk.manage.restoreTitle', { name: kiosk.name }),
  details: [{ label: t('kiosk.manage.site'), value: siteName }],
});
