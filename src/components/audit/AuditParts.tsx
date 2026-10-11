import { ArrowRight } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { AuditEvent } from '../../types/audit';
import type { StatusTone } from '../../types/index';
import { actorText, auditDetails, detailText } from '../../utils/audit';
import { formatDateTime } from '../../utils/format';

/** Clase de cada tono (la misma paleta que el resto de los catálogos con tono). */
const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'badge--muted',
  info: 'badge--info',
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
};

/**
 * El resultado de una acción, con el NOMBRE y el TONO del catálogo `audit_outcomes` (nunca escritos en la app).
 * Un código que esta versión no conoce se dibuja tal cual, en tono neutro: su código es un dato del servidor.
 */
export function OutcomeBadge({ outcome }: { outcome: string }) {
  const { byCode, nameOf } = useCatalogs();
  const tone = byCode('audit_outcomes', outcome)?.tone;
  return <span className={`badge ${TONE_CLASS[tone ?? 'muted']}`}>{nameOf('audit_outcomes', outcome)}</span>;
}

/**
 * El `antes → después` de un cambio y los datos sueltos de un evento, legibles. La LLAVE de cada línea es el
 * nombre técnico de la columna o del campo: es un dato del servidor y se muestra tal cual, así una llave nueva
 * nunca rompe la pantalla ni se oculta (es evidencia).
 */
export function AuditDetails({ details }: { details: Record<string, unknown> | null }) {
  const t = useT();
  const lines = auditDetails(details);
  if (lines.length === 0) return <span className="muted">{t('audit.noDetails')}</span>;
  return (
    <dl className="audit-details">
      {lines.map((line) => (
        <div key={line.key}>
          <dt>
            <code>{line.key}</code>
          </dt>
          <dd>
            {line.kind === 'change' ? (
              <>
                <del>{detailText(line.before)}</del> <ArrowRight size={14} aria-label={t('audit.details.change')} /> <ins>{detailText(line.after)}</ins>
              </>
            ) : (
              detailText(line.value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Sobre qué fue la acción: su tipo y su id, y de qué empresa se trata (sin empresa, es de la plataforma). */
function EntityCell({ event }: { event: AuditEvent }) {
  const t = useT();
  return (
    <>
      {event.entity_type ? (
        <code>{event.entity_id ? `${event.entity_type} ${event.entity_id}` : event.entity_type}</code>
      ) : (
        <span className="muted">{t('audit.noEntity')}</span>
      )}
      <small className="muted table__note">{event.company_name ?? t('audit.platform')}</small>
    </>
  );
}

/** Un evento de la bitácora: cuándo, qué, quién, sobre qué, desde dónde, cómo terminó y su detalle. */
export function AuditCells({ event }: { event: AuditEvent }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <>
      <td data-label={t('audit.columns.occurredAt')}>
        {formatDateTime(event.occurred_at)}
        {event.trace_id && <small className="muted table__note">{t('audit.trace', { id: event.trace_id })}</small>}
      </td>
      <td className="table__primary">{nameOf('audit_actions', event.action)}</td>
      <td data-label={t('audit.columns.actor')}>
        {actorText(event)}
        {event.actor_role && <small className="muted table__note">{nameOf('roles', event.actor_role)}</small>}
      </td>
      <td data-label={t('audit.columns.entity')}>
        <EntityCell event={event} />
      </td>
      <td data-label={t('audit.columns.origin')}>
        {event.ip ?? <span className="muted">{t('audit.noOrigin')}</span>}
        {event.user_agent && <small className="muted table__note truncate">{event.user_agent}</small>}
      </td>
      <td data-label={t('audit.columns.outcome')}>
        <OutcomeBadge outcome={event.outcome} />
      </td>
      <td data-label={t('audit.columns.details')} className="table__wide">
        <AuditDetails details={event.details} />
      </td>
    </>
  );
}
