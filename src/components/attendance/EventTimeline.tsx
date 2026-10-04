import { Crosshair, ExternalLink, MapPin, MessageSquareText, Navigation, ScanFace, UserRound } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { AttendanceEvent } from '../../types';
import { formatConfidence } from '../../utils/format';
import { CompanyBadge, isCompanyMode } from './CompanyRecord';
import { ACTION_ICONS, ACTION_TONES, clockOn, formatDistance, mapsUrl } from './sessionFacts';
import { AttendanceTimeline, TimelineStep } from './Timeline';

/** Dónde se registró: el sitio con su distancia ("a 12 m de Planta Norte") o solo el sitio. */
function siteLabel({ site, distance_m: distance }: AttendanceEvent): string | null {
  if (!site) return null;
  return distance == null ? site : `a ${formatDistance(distance)} de ${site}`;
}

/**
 * La evidencia de un registro: modalidad, sitio y distancia, precisión del GPS, confianza de la
 * verificación facial, quién lo operó y, con coordenadas, un enlace para verlas en Google Maps (otra
 * pestaña; el mapa no se incrusta). Uno de la empresa no tiene rostro ni ubicación: su insignia ya
 * dice la modalidad y aquí va su motivo.
 */
export function EventEvidence({ event }: { event: AttendanceEvent }) {
  const { nameOf } = useCatalogs();
  const site = siteLabel(event);
  const { latitude, longitude } = event;
  return (
    <ul className="att-evidence">
      {!isCompanyMode(event.mode) && (
        <li>
          <MapPin size={15} aria-hidden="true" /> {nameOf('work_modes', event.mode)}
        </li>
      )}
      {site && (
        <li>
          <Navigation size={15} aria-hidden="true" /> {site}
        </li>
      )}
      {event.accuracy_m != null && (
        <li title="Precisión de la ubicación que informó el dispositivo">
          <Crosshair size={15} aria-hidden="true" /> ±{formatDistance(event.accuracy_m)}
        </li>
      )}
      {event.confidence != null && (
        <li title="Confianza de la verificación facial">
          <ScanFace size={15} aria-hidden="true" /> Rostro {formatConfidence(event.confidence)}
        </li>
      )}
      {event.operator && (
        <li title="Quién lo registró">
          <UserRound size={15} aria-hidden="true" /> {event.operator}
        </li>
      )}
      {event.note && (
        <li className="att-evidence__note" title="Motivo de la empresa">
          <MessageSquareText size={15} aria-hidden="true" /> Motivo: {event.note}
        </li>
      )}
      {latitude != null && longitude != null && (
        <li className="att-evidence__link">
          <a href={mapsUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
            Ver en el mapa <ExternalLink size={14} aria-hidden="true" />
          </a>
        </li>
      )}
    </ul>
  );
}

/**
 * La bitácora de una jornada como línea de tiempo (la evidencia de cada registro, en orden): qué se
 * registró, a qué hora (con la fecha si cayó en otro día, p. ej. la salida de un turno nocturno) y su
 * evidencia (`EventEvidence`).
 */
export function EventTimeline({ events, workDate }: { events: AttendanceEvent[]; workDate: string }) {
  const { nameOf } = useCatalogs();
  return (
    <AttendanceTimeline label="Registros de la jornada">
      {events.map((event, index) => (
        <TimelineStep
          key={`${index}-${event.action}`}
          icon={ACTION_ICONS[event.action]}
          tone={ACTION_TONES[event.action]}
          title={nameOf('attendance_actions', event.action)}
          time={clockOn(event.occurred_at, workDate)}
          badges={isCompanyMode(event.mode) && <CompanyBadge />}
        >
          <EventEvidence event={event} />
        </TimelineStep>
      ))}
    </AttendanceTimeline>
  );
}
