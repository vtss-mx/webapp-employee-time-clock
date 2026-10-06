import { House, MapPin } from 'lucide-react';
import { useT } from '../../i18n';
import type { SiteRef } from '../../types';
import { addressLine } from '../../utils/address';
import { StatusBadge } from '../StatusBadge';
import { DeletedMark } from '../ui/DeletedMark';
import { metersText } from './shiftRules';

/** Lo remoto que se explica antes de los sitios (título y detalle). */
export interface RemotePlace {
  title: string;
  detail: string;
}

interface SitePlacesProps {
  sites: readonly SiteRef[];
  /** null: ese día (o ese turno) no se checa remoto. */
  remote?: RemotePlace | null;
}

/**
 * Dónde se checa: lo remoto (si aplica) y cada sitio con su domicilio y su radio (un sitio desactivado
 * lo dice: no acepta registros; uno en «Eliminados» lleva su marca). Lo mismo para el empleado ("Mi asistencia") y para la empresa (la
 * tarjeta del turno al asignarlo o aprobar un cambio). Lo decide el turno en el servidor.
 */
export function SitePlaces({ sites, remote = null }: SitePlacesProps) {
  const t = useT();
  return (
    <ul className="check-places stagger">
      {remote && (
        <li>
          <span className="icon-tile icon-tile--success">
            <House size={20} aria-hidden />
          </span>
          <span className="check-places__info">
            <strong>{remote.title}</strong>
            <small className="muted">{remote.detail}</small>
          </span>
        </li>
      )}
      {sites.map((site) => (
        <li key={site.id}>
          <span className="icon-tile">
            <MapPin size={20} aria-hidden />
          </span>
          <span className="check-places__info">
            <strong>
              {site.name}
              <DeletedMark deleted={site.deleted} />
            </strong>
            <small className="muted">{addressLine(site.address)}</small>
            <small className="muted">{t('shifts.card.within', { distance: metersText(site.radius_m) })}</small>
          </span>
          {!site.active && <StatusBadge active={false} />}
        </li>
      ))}
    </ul>
  );
}
