import type { ReactNode } from 'react';
import { Avatar } from '../ui/Avatar';
import { DeletedMark } from '../ui/DeletedMark';

interface PersonItemProps {
  name: string;
  /** Ruta versionada de su foto de perfil (`avatar` de la respuesta); sin ella, sus iniciales. */
  avatar?: string | null;
  /** Línea secundaria (número de empleado, departamento actual...). */
  detail?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  /** La persona ya está en «Eliminados» (una referencia del historial): su marca va antes de las insignias. */
  deleted?: boolean;
}

/**
 * Una persona en una lista de departamentos (responsables, empleados asignados, candidatos): se
 * acomoda al ancho de su contenedor (una columna en teléfono, acciones a un lado en tableta).
 */
export function PersonItem({ name, avatar, detail, badges, actions, deleted = false }: PersonItemProps) {
  return (
    <li className="people-list__item">
      <Avatar name={name} src={avatar} decorative />
      <span className="people-list__info">
        <strong className="truncate">{name}</strong>
        {detail && <small className="muted truncate">{detail}</small>}
      </span>
      {(badges || deleted) && (
        <span className="people-list__badges">
          <DeletedMark deleted={deleted} />
          {badges}
        </span>
      )}
      {actions && <span className="people-list__actions">{actions}</span>}
    </li>
  );
}
