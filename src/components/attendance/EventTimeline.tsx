import { Crosshair, ExternalLink, MapPin, MessageSquareText, Navigation, ScanFace, UserRound } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { CatalogStatusBadge } from '../StatusBadge';
import { useT, type Translate } from '../../i18n';
import type { AttendanceEvent } from '../../types';
import { formatConfidence } from '../../utils/format';
import { formatDistance } from '../../utils/numbers';
import { CompanyBadge, isCompanyMode } from './CompanyRecord';
import { ACTION_ICONS, ACTION_TONES, clockOn, mapsUrl } from './sessionFacts';
import { AttendanceTimeline, TimelineStep } from './Timeline';

/** Dónde se registró: el sitio con su distancia ("a 12 m de Planta Norte") o solo el sitio. */
function siteLabel({ site, distance_m: distance }: AttendanceEvent, t: Translate): string | null {
  if (!site) return null;
  return distance == null ? site : t('attendance.evidence.distance', { distance: formatDistance(distance), site });
}

/**
 * La evidencia de un registro: modalidad, sitio y distancia, precisión del GPS, confianza de la
 * verificación facial, quién lo operó y, con coordenadas, un enlace para verlas en Google Maps (otra
 * pestaña; el mapa no se incrusta). Uno de la empresa no tiene rostro ni ubicación: su insignia ya
 * dice la modalidad y aquí va su motivo.
 */
export function EventEvidence({ event }: { event: AttendanceEvent }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const site = siteLabel(event, t);
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
        <li title={t('attendance.evidence.accuracy')}>
          <Crosshair size={15} aria-hidden="true" /> ±{formatDistance(event.accuracy_m)}
        </li>
      )}
      {event.confidence != null && (
        <li title={t('attendance.evidence.confidence')}>
          <ScanFace size={15} aria-hidden="true" /> {t('attendance.evidence.face', { confidence: formatConfidence(event.confidence) })}
        </li>
      )}
      {event.operator && (
        <li title={t('attendance.evidence.operator')}>
          <UserRound size={15} aria-hidden="true" /> {event.operator}
        </li>
      )}
      {event.note && (
        <li className="att-evidence__note" title={t('attendance.evidence.noteTitle')}>
          <MessageSquareText size={15} aria-hidden="true" /> {t('attendance.evidence.note', { note: event.note })}
        </li>
      )}
      {latitude != null && longitude != null && (
        <li className="att-evidence__link">
          <a href={mapsUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
            {t('attendance.evidence.map')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </li>
      )}
    </ul>
  );
}

/**
 * La bitácora de una jornada como línea de tiempo (la evidencia de cada registro, en orden): qué se
 * registró, a qué hora (con la fecha si cayó en otro día, p. ej. la salida de un turno nocturno) y su
 * evidencia (`EventEvidence`). Un registro que el motor de riesgo guardó "en revisión" lo dice en su insignia.
 */
export function EventTimeline({ events, workDate }: { events: AttendanceEvent[]; workDate: string }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <AttendanceTimeline label={t('attendance.evidence.timeline')}>
      {events.map((event, index) => (
        <TimelineStep
          key={`${index}-${event.action}`}
          icon={ACTION_ICONS[event.action]}
          tone={ACTION_TONES[event.action]}
          title={nameOf('attendance_actions', event.action)}
          time={clockOn(event.occurred_at, workDate)}
          badges={
            <>
              {isCompanyMode(event.mode) && <CompanyBadge />}
              {event.under_review && <CatalogStatusBadge catalog="attendance_review_statuses" code="PENDING" />}
            </>
          }
        >
          <EventEvidence event={event} />
        </TimelineStep>
      ))}
    </AttendanceTimeline>
  );
}
