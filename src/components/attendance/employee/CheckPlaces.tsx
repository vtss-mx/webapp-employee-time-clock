import { House, MapPin, MapPinOff } from 'lucide-react';
import type { AttendanceToday } from '../../../types';
import { EmptyState } from '../../ui/EmptyState';
import { formatDistance } from '../sessionFacts';

/**
 * Dónde puede checar la jornada que se muestra (la de hoy o la siguiente): de forma remota (si ese día su empresa lo permite) y en sus sitios de
 * trabajo (dentro del radio de cada uno). Lo decide el servidor; aquí solo se explica.
 */
export function CheckPlaces({ today }: { today: AttendanceToday }) {
  if (!today.remote_allowed && !today.sites.length) {
    return (
      <EmptyState
        compact
        icon={<MapPinOff />}
        title="Sin sitio de trabajo asignado"
        description="Esta jornada no es remota y tu empresa no te asignó un sitio. Pídele que te asigne uno para poder registrar tu asistencia."
      />
    );
  }
  return (
    <ul className="check-places stagger">
      {today.remote_allowed && (
        <li>
          <span className="icon-tile icon-tile--success">
            <House size={20} aria-hidden />
          </span>
          <span className="check-places__info">
            <strong>Puedes checar de forma remota</strong>
            <small className="muted">Desde cualquier lugar, con tu rostro y tu ubicación.</small>
          </span>
        </li>
      )}
      {today.sites.map((site) => (
        <li key={site.id}>
          <span className="icon-tile">
            <MapPin size={20} aria-hidden />
          </span>
          <span className="check-places__info">
            <strong>{site.name}</strong>
            <small className="muted">Dentro de {formatDistance(site.radius_m)} de su ubicación</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
