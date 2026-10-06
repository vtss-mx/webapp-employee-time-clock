import { useT } from '../../i18n';

interface DeletedMarkProps {
  /** El registro al que se refiere ya está en «Eliminados» (`EmployeeRef.deleted`, `ShiftRef.deleted`, `SiteRef.deleted`); si no, no se dibuja. */
  deleted?: boolean;
  /** Texto propio (por omisión «Eliminado»). */
  label?: string;
}

/**
 * Marca discreta junto al nombre de un empleado, un turno o un sitio que ya se eliminó, donde el historial lo
 * sigue nombrando (jornadas, calendario, solicitudes, asignaciones, sitios de un turno). Lo registrado no cambia:
 * la marca solo explica por qué ese registro ya no aparece en su listado.
 */
export function DeletedMark({ deleted = false, label }: DeletedMarkProps) {
  const t = useT();
  if (!deleted) return null;
  return <span className="badge badge--muted badge--plain deleted-mark">{label ?? t('ui.trash.mark')}</span>;
}
