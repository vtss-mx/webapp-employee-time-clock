import { Building2, MessageSquareText } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { WorkMode, WorkSession } from '../../types';
import { formatDateTime } from '../../utils/format';

/**
 * Lo que registró o corrigió la empresa (decisión del dueño del producto: solo la empresa, sin rostro
 * ni ubicación y siempre con un motivo). Se dibuja igual para la empresa y para el empleado, y es de
 * solo lectura: el empleado lo ve en su historial, nunca lo edita.
 */

/** La modalidad de un registro hecho por la empresa (catálogo work_modes). */
export const isCompanyMode = (mode: WorkMode | null | undefined) => mode === 'COMPANY';

/** Insignia "Registrado por la empresa" (el nombre sale del catálogo work_modes, no del código). */
export function CompanyBadge() {
  const { nameOf } = useCatalogs();
  return (
    <span className="badge badge--plain badge--info att-company">
      <Building2 size={14} aria-hidden /> {nameOf('work_modes', 'COMPANY')}
    </span>
  );
}

/**
 * La jornada la registró o la corrigió la empresa: la insignia, cuándo y su motivo. Sin `edited_at`
 * (registrada por el propio empleado) no se dibuja.
 *
 *   <CompanyEditNote session={session} />
 */
export function CompanyEditNote({ session }: { session: Pick<WorkSession, 'edited_at' | 'edit_reason'> }) {
  if (!session.edited_at) return null;
  return (
    <div className="att-edited">
      <CompanyBadge />
      <span className="att-edited__when">{formatDateTime(session.edited_at)}</span>
      {session.edit_reason && (
        <p className="att-edited__reason">
          <MessageSquareText size={16} aria-hidden />
          <span>
            <strong>Motivo:</strong> {session.edit_reason}
          </span>
        </p>
      )}
    </div>
  );
}
