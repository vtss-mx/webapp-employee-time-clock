import { MessageSquareText, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';

/** Lista de tarjetas del empleado (sus jornadas o sus solicitudes); atenuada mientras carga otra página. */
export function AttendanceList({ loading, children }: { loading: boolean; children: ReactNode }) {
  return <ul className={`attendance-list stagger ${loading ? 'is-loading' : ''}`}>{children}</ul>;
}

interface AttendanceItemProps {
  icon: ReactNode;
  title: string;
  detail: string;
  /** Estado (del catálogo) y otras insignias. */
  badges: ReactNode;
  children: ReactNode;
  /** Acciones de la tarjeta (a lo ancho, al alcance del pulgar en el teléfono). */
  actions?: ReactNode;
}

/** Tarjeta de la lista: ícono, título, detalle e insignias arriba; el contenido y sus acciones debajo. */
export function AttendanceItem({ icon, title, detail, badges, children, actions }: AttendanceItemProps) {
  return (
    <li className="attendance-item">
      <div className="attendance-item__head">
        <span className="icon-tile" aria-hidden>
          {icon}
        </span>
        <span className="attendance-item__title">
          <strong>{title}</strong>
          <small className="muted">{detail}</small>
        </span>
        <span className="attendance-item__badges">{badges}</span>
      </div>
      {children}
      {actions && <div className="attendance-item__actions">{actions}</div>}
    </li>
  );
}

/** Nota destacada de una tarjeta (p. ej. la respuesta de la empresa): ícono, etiqueta y el texto. */
export function ItemNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="attendance-item__note">
      <MessageSquareText size={18} aria-hidden />
      <span>
        <strong>{label}</strong> {children}
      </span>
    </p>
  );
}

/** "Cancelar solicitud" de una solicitud pendiente (cambio de turno, vacaciones o permiso). */
export function CancelRequestButton({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <Button variant="danger-outline" size="lg" icon={<X size={18} />} loading={busy} onClick={onCancel}>
      Cancelar solicitud
    </Button>
  );
}
