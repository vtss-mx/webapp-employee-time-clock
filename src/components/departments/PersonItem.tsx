import type { ReactNode } from 'react';
import { initials } from '../../utils/format';

interface PersonItemProps {
  name: string;
  /** Línea secundaria (número de empleado, departamento actual...). */
  detail?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}

/**
 * Una persona en una lista de departamentos (responsables, empleados asignados, candidatos): se
 * acomoda al ancho de su contenedor (una columna en teléfono, acciones a un lado en tableta).
 */
export function PersonItem({ name, detail, badges, actions }: PersonItemProps) {
  return (
    <li className="people-list__item">
      <span className="avatar">{initials(name)}</span>
      <span className="people-list__info">
        <strong className="truncate">{name}</strong>
        {detail && <small className="muted truncate">{detail}</small>}
      </span>
      {badges && <span className="people-list__badges">{badges}</span>}
      {actions && <span className="people-list__actions">{actions}</span>}
    </li>
  );
}
