import { ArchiveRestore } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { t } from '../../i18n';
import type { Restored } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';

/** Lo propio de cada registro en la confirmación de restaurar (se arma al dibujarse: sigue al idioma activo). */
export interface RestoreQuestion {
  /** La pregunta con el registro: «¿Restaurar a Ana Ruiz?». */
  title: string;
  /** Qué regresa (líneas o "Etiqueta: valor"). */
  details?: ConfirmDetail[];
  /** Lo que no regresa: a un empleado, su rostro (`ui.trash.faceAgain`); a una cuenta, sus fotos. */
  note?: string;
}

/** Restaurar: qué regresa de «Eliminados» y, si es una persona, lo que no regresa con ella. */
export function restoreConfirm({ title, details, note }: RestoreQuestion): ConfirmInput {
  return {
    kind: 'action',
    tone: 'success',
    icon: <ArchiveRestore size={30} />,
    eyebrow: t('ui.trash.eyebrow'),
    title,
    details,
    note,
    confirmLabel: t('ui.trash.restore'),
    confirmIcon: <ArchiveRestore size={18} />,
  };
}

/**
 * «Restaurar» de un listado o un detalle (único mecanismo): pregunta antes (`useAction` + `confirm`), avisa con
 * el mensaje del servidor (ya traducido: «Empleado restaurado. Debe registrar su rostro de nuevo.») y entrega
 * el registro de vuelta (`onRestored`: refrescar la lista o mostrar el detalle vigente). Un conflicto
 * (`RESTORE_CONFLICT`: algo ocupa ya su lugar) o una regla del negocio llegan en el popup con su motivo.
 * `restoring` es el id que se está restaurando (cada botón muestra su propio "ocupado").
 */
export function useRestore() {
  const { busy, run } = useAction<number>();
  const restore = <T,>(id: number, task: () => Promise<Restored<T>>, question: () => RestoreQuestion, onRestored: (item: T) => void) =>
    run(task, {
      busy: id,
      confirm: () => restoreConfirm(question()),
      errorTitle: () => t('ui.trash.restoreError'),
      success: (result) => [result.message],
      onSuccess: (result) => onRestored(result.item),
    });
  return { restoring: busy, restore };
}
