import { CheckCircle2, Fingerprint, Globe, XCircle } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { FraudCaseAttempt, FraudCaseEvent, FraudNetwork, RiskReason } from '../../types';
import { DbIpCredit } from './DbIpCredit';
import { formatDateTime } from '../../utils/format';
import { formatNumber } from '../../utils/numbers';
import { cameraName } from '../../utils/cameraDevices';

/**
 * Una señal del intento: "Cámara sin nombre: 0.07 (umbral 0.25) · +20 pts · Obligatoria" y, debajo, qué mide y por
 * qué delata un fraude (la explicación del catálogo, en el idioma de la petición).
 */
function SignalLine({ signal }: { signal: RiskReason }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const measured =
    signal.value === null ? null : signal.threshold === null ? formatNumber(signal.value) : t('fraud.attempts.measured', { value: formatNumber(signal.value), threshold: formatNumber(signal.threshold) });
  return (
    <li className={signal.points > 0 ? 'text-danger' : undefined}>
      <strong>{signal.name}</strong>
      {measured && `: ${measured}`}
      {' · '}
      {signal.points > 0 ? t('fraud.attempts.points', { points: formatNumber(signal.points) }) : t('fraud.attempts.noPoints')}
      {' · '}
      {nameOf('signal_modes', signal.mode)}
      {signal.description && <span className="fraud-attempts__why muted">{signal.description}</span>}
    </li>
  );
}

/** La red de la IP del intento (país, sistema autónomo, organización y si es una nube) con su atribución. */
function NetworkLine({ network }: { network: FraudNetwork }) {
  const t = useT();
  const parts = [
    network.country,
    network.asn !== null && t('fraud.attempts.asn', { asn: network.asn }),
    network.organization,
    network.hosting && t('fraud.attempts.hosting'),
  ].filter(Boolean);
  return (
    <span className="small muted">
      <Globe size={14} /> {t('fraud.attempts.network', { network: parts.join(' · ') })} · <DbIpCredit />
    </span>
  );
}

/**
 * Los intentos del caso (los primeros `FRAUD_CASE_MAX_ATTEMPTS`, con la copia de lo que se midió: sobrevive a la
 * retención de la bitácora): resultado, motivo, puntaje y acción del motor, cada señal con su valor, umbral y
 * puntos, los números medidos, la cámara, la IP y el navegador, y cuántas huellas dejó.
 */
export function FraudAttempts({ attempts }: { attempts: FraudCaseAttempt[] }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <ul className="log-list log-list--stacked fraud-attempts">
      {attempts.map((attempt) => (
        <li key={attempt.id}>
          <span className="fraud-attempts__head">
            {attempt.success ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-danger" />}
            <strong>{formatDateTime(attempt.attempted_at)}</strong>
            <span className="small muted">
              {[
                attempt.success ? t('fraud.attempts.passed') : t('fraud.attempts.failed'),
                attempt.reason && nameOf('verification_reasons', attempt.reason),
                attempt.score !== null && t('fraud.attempts.score', { score: formatNumber(attempt.score) }),
                attempt.action && nameOf('risk_actions', attempt.action),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          {attempt.signals.length > 0 && (
            <ul className="fraud-attempts__signals small">
              {attempt.signals.map((signal) => (
                <SignalLine key={signal.code} signal={signal} />
              ))}
            </ul>
          )}
          {Object.keys(attempt.metrics).length > 0 && (
            <dl className="fraud-attempts__metrics small">
              {Object.entries(attempt.metrics).map(([name, value]) => (
                <div key={name}>
                  {/* El nombre de la métrica es un identificador técnico del motor (frontal_real_min), no un texto de un idioma. */}
                  <dt>
                    <code>{name}</code>
                  </dt>
                  <dd>{typeof value === 'number' ? formatNumber(value) : value}</dd>
                </div>
              ))}
            </dl>
          )}
          {attempt.network && <NetworkLine network={attempt.network} />}
          <span className="small muted">
            <Fingerprint size={14} />{' '}
            {[
              t('fraud.attempts.signatures', { count: attempt.signatures }),
              attempt.camera ? t('fraud.attempts.camera', { camera: cameraName(attempt.camera) }) : t('fraud.attempts.noCamera'),
              attempt.ip_address,
              attempt.user_agent,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** El historial del caso: quién hizo qué y cuándo (abrirlo, tomarlo, decidirlo, notas, evidencia consultada...). */
export function FraudEvents({ events }: { events: FraudCaseEvent[] }) {
  const { nameOf } = useCatalogs();
  return (
    <ul className="log-list log-list--stacked">
      {events.map((event) => (
        <li key={event.id}>
          <strong>{nameOf('fraud_case_event_kinds', event.kind)}</strong>
          <span className="small muted">{[formatDateTime(event.created_at), event.actor].filter(Boolean).join(' · ')}</span>
          {event.status_to && (
            <span className="small">
              {nameOf('fraud_case_statuses', event.status_from)} → {nameOf('fraud_case_statuses', event.status_to)}
            </span>
          )}
          {event.note && <span className="small">{event.note}</span>}
        </li>
      ))}
    </ul>
  );
}
