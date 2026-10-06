import { MapPinOff } from 'lucide-react';
import { useT } from '../../../i18n';
import type { AttendanceToday } from '../../../types';
import { SitePlaces } from '../../shifts/SitePlaces';
import { EmptyState } from '../../ui/EmptyState';

/**
 * Dónde puede checar la jornada que se muestra (la de hoy o la siguiente): de forma remota (si ese día
 * su turno lo permite) y en los sitios de su turno (dentro del radio de cada uno, con su domicilio).
 * Lo decide el turno en el servidor; aquí solo se explica.
 */
export function CheckPlaces({ today }: { today: AttendanceToday }) {
  const t = useT();
  if (!today.remote_allowed && !today.sites.length) {
    return <EmptyState compact icon={<MapPinOff />} title={t('myAttendance.places.noSite.title')} description={t('myAttendance.places.noSite.description')} />;
  }
  const remote = today.remote_allowed ? { title: t('myAttendance.places.remote.title'), detail: t('myAttendance.places.remote.detail') } : null;
  return <SitePlaces sites={today.sites} remote={remote} />;
}
