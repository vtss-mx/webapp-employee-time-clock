import { CheckCircle2, Fingerprint, Gauge, MapPin, MapPinOff, ScanFace, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import type { CompanyVerification, VerificationDetail, VerificationMeasurement, VerificationSummary } from '../../types';
import { employeeLabel } from '../../utils/employeeLabel';
import { formatDateTime, timeAgo } from '../../utils/format';
import { formatDistance, formatNumber } from '../../utils/numbers';
import { VerificationEvidence } from './VerificationEvidence';
import { NetworkLine, RiskSignalLine } from '../fraud/FraudAttempts';
import { RiskBadge } from '../fraud/RiskBadge';
import { CatalogStatusBadge } from '../StatusBadge';
import { Avatar } from '../ui/Avatar';
import { DeletedMark } from '../ui/DeletedMark';
import { KpiGrid, type Kpi } from '../ui/KpiCard';
import { PanelSection } from '../ui/Panel';

/**
 * Piezas del historial de verificaciones que comparten la pantalla del ADMIN (todas las empresas) y la de la
 * empresa (la suya): las tarjetas del periodo, la persona de una fila, su resultado, dónde se hizo y el detalle
 * técnico completo (regla 6: una sola implementación para las dos pantallas).
 *
 * **Nada biométrico** (regla 13): lo que se dibuja son números, códigos y veredictos, más la foto de PERFIL de la
 * persona. Los fotogramas de un intento no existen aquí: si abrió un caso de fraude, el detalle solo lo nombra; la
 * evidencia vive en la pantalla del caso, tras confirmar y con su registro.
 */

/** Las tarjetas del periodo: lo que alguien mira primero (los conteos los agrupó la base, nunca la app). */
export function VerificationKpis({ summary }: { summary: VerificationSummary | null }) {
  const failed = summary?.failed;
  const risky = summary?.by_risk_tier.reduce((total, row) => total + row.total, 0);
  const kpis: Kpi[] = [
    { key: 'total', label: t('verification.summary.total'), icon: ScanFace, value: summary?.total, tile: '' },
    { key: 'succeeded', label: t('verification.summary.succeeded'), icon: CheckCircle2, value: summary?.succeeded, tile: 'icon-tile--success' },
    { key: 'failed', label: t('verification.summary.failed'), icon: XCircle, value: failed, tile: failed ? 'icon-tile--danger' : '' },
    { key: 'located', label: t('verification.summary.located'), icon: MapPin, value: summary?.located, tile: '' },
    { key: 'risky', label: t('verification.summary.risky'), icon: ShieldAlert, value: risky, tile: risky ? 'icon-tile--warning' : '' },
  ];
  return <KpiGrid kpis={kpis} />;
}

/** El desglose del periodo (métodos, motivos de rechazo y niveles de riesgo) con los nombres de sus catálogos. */
export function VerificationBreakdown({ summary }: { summary: VerificationSummary }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const rows: [string, string][] = [
    [t('verification.summary.byMethod'), summary.by_method.map((row) => `${nameOf('verification_methods', row.method)}: ${formatNumber(row.total)}`).join(' · ')],
    [t('verification.summary.byReason'), summary.by_reason.map((row) => `${nameOf('verification_reasons', row.reason)}: ${formatNumber(row.total)}`).join(' · ')],
    [t('verification.summary.byTier'), summary.by_risk_tier.map((row) => `${nameOf('risk_tiers', row.tier)}: ${formatNumber(row.total)}`).join(' · ')],
  ];
  return (
    <dl className="details">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      <div>
        <dt>{t('verification.summary.period')}</dt>
        <dd>{t('verification.summary.periodValue', { since: formatDateTime(summary.since), until: formatDateTime(summary.until) })}</dd>
      </div>
    </dl>
  );
}

/** La persona de una fila con su foto de perfil (o, si no se supo quién era, que no se identificó). */
export function VerificationPerson({ row }: { row: CompanyVerification }) {
  const t = useT();
  if (!row.employee_name) return <span className="muted">{t('verification.company.notIdentified')}</span>;
  return (
    <span className="person">
      <Avatar name={row.employee_name} src={row.avatar} decorative />
      <span className="person__info">
        <strong className="truncate">{row.employee_name}</strong>
        {row.employee_number && <small>{row.employee_number}</small>}
      </span>
    </span>
  );
}

/** El resultado de un intento: exitoso o el motivo del rechazo con el nombre de su catálogo. */
export function VerificationOutcome({ success, reason }: { success: boolean; reason: string | null }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (success) return <span className="badge badge--success">{t('verification.outcome.success')}</span>;
  return <span className="badge badge--muted">{nameOf('verification_reasons', reason, t('verification.outcome.failed'))}</span>;
}

/** Dónde se hizo, en una celda: su precisión o que la verificación no llevó ubicación. */
export function VerificationWhere({ latitude, accuracy }: { latitude: number | null; accuracy: number | null }) {
  const t = useT();
  if (latitude === null) {
    return (
      <span className="muted inline-note">
        <MapPinOff size={16} /> {t('verification.company.place.none')}
      </span>
    );
  }
  return (
    <span className="inline-note">
      <MapPin size={16} /> {accuracy === null ? t('verification.detail.located') : t('verification.company.place.accuracy', { distance: formatDistance(accuracy) })}
    </span>
  );
}

/** Los números medidos del intento: su nombre técnico del motor y su valor (nunca una imagen). */
function Measurement({ measurement }: { measurement: VerificationMeasurement }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const numbers = Object.entries(measurement).filter(([name, value]) => typeof value === 'number' && name !== 'steps');
  const pad = Object.entries(measurement.pad ?? {});
  return (
    <>
      <dl className="details">
        <div>
          <dt>{t('verification.detail.steps')}</dt>
          <dd>{measurement.steps === null ? t('common.values.empty') : formatNumber(measurement.steps)}</dd>
        </div>
        {measurement.platform && (
          <div>
            <dt>{t('verification.detail.platform')}</dt>
            {/* La plataforma es una categoría técnica del motor (IOS_SAFARI), no un texto de un idioma. */}
            <dd>
              <code>{measurement.platform}</code>
            </dd>
          </div>
        )}
        {measurement.flash_mode && (
          <div>
            <dt>{t('verification.detail.flashMode')}</dt>
            <dd>{nameOf('flash_modes', measurement.flash_mode)}</dd>
          </div>
        )}
        {measurement.fraud_label && (
          <div>
            <dt>{t('verification.detail.fraudLabel')}</dt>
            <dd>
              <code>{measurement.fraud_label}</code>
            </dd>
          </div>
        )}
      </dl>
      <dl className="fraud-attempts__metrics small">
        {[...numbers, ...pad.map(([family, value]) => [`pad.${family}`, value] as [string, number])].map(([name, value]) => (
          <div key={name}>
            {/* El nombre de la medición es un identificador técnico del motor (frontal_real_min), no un texto. */}
            <dt>
              <code>{name}</code>
            </dt>
            <dd>{formatNumber(value as number)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Quién y cuándo: la persona, el método, el resultado y quién operó la cámara. */
function Who({ detail }: { detail: VerificationDetail }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const actor = detail.actor;
  return (
    <dl className="details">
      <div>
        <dt>{t('verification.detail.when')}</dt>
        <dd>
          {formatDateTime(detail.created_at)} <small className="muted">{timeAgo(detail.created_at)}</small>
        </dd>
      </div>
      <div>
        <dt>{t('verification.company.columns.result')}</dt>
        <dd>
          <VerificationOutcome success={detail.success} reason={detail.reason} />
        </dd>
      </div>
      <div>
        <dt>{t('verification.company.columns.method')}</dt>
        <dd>{nameOf('verification_methods', detail.method)}</dd>
      </div>
      {detail.confidence !== null && (
        <div>
          <dt>{t('verification.result.confidence')}</dt>
          <dd>{formatNumber(detail.confidence)}</dd>
        </div>
      )}
      {detail.company_name && (
        <div>
          <dt>{t('common.fields.company')}</dt>
          <dd>{detail.company_name}</dd>
        </div>
      )}
      <div>
        <dt>{t('common.fields.employee')}</dt>
        <dd>
          {detail.employee ? employeeLabel(detail.employee) : t('verification.company.notIdentified')}
          <DeletedMark deleted={detail.employee?.deleted} />
        </dd>
      </div>
      {actor && (
        <div>
          <dt>{t('verification.detail.actor')}</dt>
          <dd>
            {[actor.role && nameOf('roles', actor.role), actor.name, actor.email].filter(Boolean).join(' · ') || t('verification.detail.apiDevice')}
            {actor.device && (
              <small className="muted">
                {' · '}
                <Fingerprint size={14} /> <code>{actor.device}</code>
              </small>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Dónde se hizo: el punto con su precisión, el sitio, el código de presencia, la IP y su red. */
function Where({ detail }: { detail: VerificationDetail }) {
  const t = useT();
  const { place } = detail;
  return (
    <>
      <dl className="details">
        <div>
          <dt>{t('verification.company.columns.place')}</dt>
          <dd>
            <VerificationWhere latitude={place.latitude} accuracy={place.location_accuracy_m} />
          </dd>
        </div>
        {place.site && (
          <div>
            <dt>{t('verification.detail.site')}</dt>
            <dd>
              {place.site.name}
              <DeletedMark deleted={place.site.deleted} />
            </dd>
          </div>
        )}
        <div>
          <dt>{t('verification.detail.presenceCode')}</dt>
          <dd>{place.presence_code_used ? t('common.values.yes') : t('common.values.no')}</dd>
        </div>
        {place.ip_address && (
          <div>
            <dt>{t('verification.detail.ip')}</dt>
            <dd>{place.ip_address}</dd>
          </div>
        )}
        {place.user_agent && (
          <div>
            <dt>{t('verification.detail.browser')}</dt>
            <dd className="truncate">{place.user_agent}</dd>
          </div>
        )}
      </dl>
      {place.network && <NetworkLine network={place.network} />}
    </>
  );
}

/** La decisión del motor de riesgo con CADA señal (su valor, su umbral, su modo y sus puntos). */
function Risk({ detail }: { detail: VerificationDetail }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const risk = detail.risk;
  if (!risk) return <p className="muted small">{t('verification.detail.noRisk')}</p>;
  return (
    <>
      <p>
        <RiskBadge tier={risk.tier} score={risk.score} /> <span className="badge badge--muted">{nameOf('risk_actions', risk.action)}</span>
      </p>
      <p className="muted small">
        {[risk.step_up && t('verification.detail.stepUp'), risk.fallback && t('verification.detail.fallback'), t('verification.detail.engine', { engine: risk.engine, version: risk.policy_version })]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {risk.signals.length > 0 ? (
        <ul className="fraud-attempts__signals small">
          {risk.signals.map((signal) => (
            <RiskSignalLine key={signal.code} signal={signal} />
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('verification.detail.noSignals')}</p>
      )}
    </>
  );
}

/**
 * El detalle de un intento con todo lo que se midió, en secciones: quién y cuándo, dónde (con la red de su IP y su
 * atribución obligatoria), lo medido, la decisión del motor de riesgo y, si abrió un caso de fraude, cuál.
 *
 * `caseLink` dibuja el enlace al caso (solo el ADMIN tiene esa pantalla); sin él, el caso solo se nombra.
 */
export function VerificationDetailView({ detail, caseLink }: { detail: VerificationDetail; caseLink?: (caseId: number) => ReactNode }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <>
      <PanelSection title={t('verification.detail.who')} icon={<ScanFace size={20} />}>
        <Who detail={detail} />
        <VerificationEvidence detail={detail} />
      </PanelSection>
      <PanelSection title={t('verification.detail.where')} icon={<MapPin size={20} />}>
        <Where detail={detail} />
      </PanelSection>
      <PanelSection title={t('verification.detail.measured')} icon={<Gauge size={20} />}>
        {detail.measurement ? <Measurement measurement={detail.measurement} /> : <p className="muted small">{t('verification.detail.noMeasurement')}</p>}
      </PanelSection>
      <PanelSection title={t('verification.detail.risk')} icon={<ShieldCheck size={20} />}>
        <Risk detail={detail} />
      </PanelSection>
      {detail.case && (
        <PanelSection title={t('verification.detail.case')} icon={<ShieldAlert size={20} />}>
          <p>
            <CatalogStatusBadge catalog="fraud_case_statuses" code={detail.case.status} /> <span className="badge badge--muted">{nameOf('fraud_kinds', detail.case.kind)}</span>
          </p>
          {caseLink?.(detail.case.id)}
          <p className="muted small">{t('verification.detail.caseNote')}</p>
        </PanelSection>
      )}
    </>
  );
}
