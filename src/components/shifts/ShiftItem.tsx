import type { ReactNode } from 'react';

interface ShiftItemProps {
  /** Ícono o avatar a la izquierda. */
  lead: ReactNode;
  title: ReactNode;
  /** Estado (insignias del catálogo). */
  badges: ReactNode;
  /** Acciones de la fila (solo si aplican). */
  actions?: ReactNode;
  /** Renglones de detalle bajo el título. */
  children: ReactNode;
}

/**
 * Una asignación o una solicitud de cambio en una lista de tarjetas (mismas clases que las listas de
 * personas): se acomoda al ancho del contenedor, con las acciones a lo ancho en el teléfono.
 */
export function ShiftItem({ lead, title, badges, actions, children }: ShiftItemProps) {
  return (
    <li className="people-list__item shift-item">
      {lead}
      <span className="people-list__info shift-item__info">
        <strong>{title}</strong>
        {children}
      </span>
      <span className="people-list__badges">{badges}</span>
      {actions && <span className="people-list__actions">{actions}</span>}
    </li>
  );
}
