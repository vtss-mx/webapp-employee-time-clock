import { CheckCircle2, Hourglass, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { AttackedCompany, FaceSecurityOverview, IpDatabaseStatus, SecurityThreshold } from '../../types/faceSecurity';
import { flashReadiness, formatThreshold } from '../../utils/faceSecurity';
import { formatDate, formatDateTime, initials } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { DbIpCredit } from '../fraud/DbIpCredit';
import { FactList } from '../performance/PerformanceParts';
import { EmptyState } from '../ui/EmptyState';
import { RangeMeter } from '../ui/RangeMeter';

/*
 * Secciones de la pantalla "Seguridad facial" (solo el ADMIN): umbrales autocalibrados, empresas
 * reforzadas por ataques y lo medido del destello de colores. Solo dibujan lo que envía el backend.
 */

/** Un umbral: su valor frente a su mínimo y su tope, si la plataforma lo endureció y con cuántos datos. */
function ThresholdCard({ threshold }: { threshold: SecurityThreshold }) {
  const t = useT();
  const { key, name, value, floor, cap, samples, computed_at, raised, upper } = threshold;
  const format = (v: number) => formatThreshold(key, v);
  // Un máximo (el moiré) parte de su tope y se endurece bajando: los extremos dicen eso.
  const labels = upper ? { min: t('faceSecurity.thresholds.tightest'), max: t('faceSecurity.thresholds.start') } : undefined;
  return (
    <li className={`threshold ${raised ? 'threshold--raised' : ''}`.trim()}>
      <div className="threshold__head">
        <strong>{name}</strong>
        {raised ? (
          <span className="badge badge--success">{t('faceSecurity.thresholds.raised')}</span>
        ) : (
          <span className="badge badge--muted">{t(upper ? 'faceSecurity.thresholds.atStart' : 'faceSecurity.thresholds.atFloor')}</span>
        )}
      </div>
      <span className="threshold__value">{format(value)}</span>
      <RangeMeter value={value} min={floor} max={cap} label={`${name}: ${format(value)}`} format={format} labels={labels} tone={raised ? 'success' : 'primary'} />
      <p className="muted small">
        {t('faceSecurity.thresholds.measured', { count: samples })} ·{' '}
        {computed_at ? t('faceSecurity.thresholds.computed', { date: formatDateTime(computed_at) }) : t('faceSecurity.thresholds.notComputed')}
      </p>
    </li>
  );
}

/** Umbrales de la prueba de vida y del anti-spoofing (solo suben: nunca bajan de su mínimo). */
export function ThresholdList({ thresholds }: { thresholds: SecurityThreshold[] }) {
  return (
    <ul className="threshold-list stagger">
      {thresholds.map((threshold) => (
        <ThresholdCard key={threshold.key} threshold={threshold} />
      ))}
    </ul>
  );
}

/** Empresas con intentos sospechosos recientes: sus retos piden el máximo de movimientos. */
export function ReinforcedCompanies({ companies, minAttacks, windowMinutes }: { companies: AttackedCompany[]; minAttacks: number; windowMinutes: number }) {
  const t = useT();
  const rule = t('faceSecurity.reinforced.rule', { count: minAttacks, minutes: formatCount(windowMinutes) });
  if (companies.length === 0) {
    return <EmptyState compact tone="success" icon={<ShieldCheck />} title={t('faceSecurity.reinforced.emptyTitle')} description={rule} />;
  }
  return (
    <>
      <p className="muted small">{rule}</p>
      <ul className="company-list">
        {companies.map((company) => (
          <li key={company.company_id}>
            <Link to={paths.admin.company(company.company_id)} className="company-row">
              <span className="company-row__logo">{initials(company.name)}</span>
              <span className="company-row__info">
                <strong className="truncate">{company.name}</strong>
                <small className="muted">{t('faceSecurity.reinforced.challenges')}</small>
              </span>
              <span className="badge badge--danger">{t('faceSecurity.reinforced.attempts', { count: company.attacks })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Estado del destello: listo para exigirlo o qué falta (para la sección y su insignia). */
export function FlashReadinessBadge({ overview }: { overview: FaceSecurityOverview }) {
  const t = useT();
  const { ready } = flashReadiness(overview);
  return <span className={`badge ${ready ? 'badge--success' : 'badge--warning'}`}>{t(ready ? 'faceSecurity.flash.ready' : 'faceSecurity.flash.calibrating')}</span>;
}

const decimal = (value: number | null) => formatThreshold('FLASH_SCORE', value);

/**
 * Lo medido del destello de colores en los intentos exitosos (modo «Solo medir»), con cuándo es
 * seguro pasar una empresa a «Obligatorio» (los nombres de los modos salen del catálogo `flash_modes`).
 */
export function FlashObservationPanel({ overview }: { overview: FaceSecurityOverview }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { flash, window_days } = overview;
  const { ready, pending } = flashReadiness(overview);
  const stats = [
    { label: t('faceSecurity.flash.measured'), value: formatCount(flash.measured) },
    { label: t('faceSecurity.flash.conclusive'), value: formatCount(flash.conclusive) },
    { label: t('faceSecurity.flash.bright'), value: formatCount(flash.inconclusive) },
    { label: t('faceSecurity.flash.medianScore'), value: decimal(flash.score_median) },
    { label: t('faceSecurity.flash.lowScore'), value: decimal(flash.score_p10) },
    { label: t('faceSecurity.flash.medianMagnitude'), value: decimal(flash.magnitude_median) },
    // Cociente rostro/fondo: ≈ 1 es una pantalla o un papel (todo se tiñe igual); un rostro real responde más.
    { label: t('faceSecurity.flash.medianRatio'), value: decimal(flash.ratio_median) },
    { label: t('faceSecurity.flash.lowRatio'), value: decimal(flash.ratio_p10) },
  ];
  return (
    <>
      <p className="muted small">
        {t('faceSecurity.flash.window', { count: window_days })} {t('faceSecurity.flash.explain')}
      </p>
      <FactList items={stats} />
      <ReadinessCallout
        ready={ready}
        title={t(ready ? 'faceSecurity.flash.canEnforce' : 'faceSecurity.flash.notYet')}
        advice={t('faceSecurity.flash.advice', { enforce: nameOf('flash_modes', 'ENFORCE'), observe: nameOf('flash_modes', 'OBSERVE') })}
        pending={pending}
      />
    </>
  );
}

/** Veredicto de "¿conviene exigirlo?" (destello o protocolo de captura): listo o lo que aún falta medir. */
export function ReadinessCallout({ ready, title, advice, pending }: { ready: boolean; title: string; advice: string; pending: string[] }) {
  return (
    <div className={`callout ${ready ? 'callout--success' : ''}`.trim()}>
      <span className={`icon-tile ${ready ? 'icon-tile--success' : 'icon-tile--warning'}`}>{ready ? <CheckCircle2 size={22} /> : <Hourglass size={22} />}</span>
      <div className="callout__body">
        <strong>{title}</strong>
        <p className="muted small">{advice}</p>
        {pending.length > 0 && (
          <ul className="small">
            {pending.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * La base local de IP del servidor (antifraude 1b, DB-IP Lite): cuándo se construyó cada archivo o que falta (sin él
 * las señales de red no se miden), si se actualiza sola y su atribución (CC BY 4.0).
 */
export function IpDatabasePanel({ status }: { status: IpDatabaseStatus }) {
  const t = useT();
  const files = [
    ['country', status.country],
    ['asn', status.asn],
  ] as const;
  return (
    <div className="stack">
      <dl className="details">
        {files.map(([kind, file]) => (
          <div key={kind}>
            <dt>{t(`faceSecurity.ip.${kind}`)}</dt>
            <dd className={file ? undefined : 'text-warning'}>{file ? t('faceSecurity.ip.built', { date: formatDate(file.built_at) }) : t('faceSecurity.ip.missing')}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">
        {status.refresh_enabled ? t('faceSecurity.ip.refresh', { count: status.refresh_days }) : t('faceSecurity.ip.refreshOff')} {t('faceSecurity.ip.privacy')} <DbIpCredit />
      </p>
    </div>
  );
}
