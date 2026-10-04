import { CheckCircle2, Hourglass, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { paths } from '../../routes/paths';
import type { AttackedCompany, FaceSecurityOverview, SecurityThreshold } from '../../types/faceSecurity';
import { flashReadiness, formatThreshold } from '../../utils/faceSecurity';
import { formatDateTime, initials } from '../../utils/format';
import { EmptyState } from '../ui/EmptyState';
import { RangeMeter } from '../ui/RangeMeter';

/*
 * Secciones de la pantalla "Seguridad facial" (solo el ADMIN): umbrales autocalibrados, empresas
 * reforzadas por ataques y lo medido del destello de colores. Solo dibujan lo que envía el backend.
 */

const count = (value: number, one: string, many: string) => `${value.toLocaleString('es-MX')} ${value === 1 ? one : many}`;

/** Un umbral: su valor frente a su mínimo y su tope, si la plataforma lo endureció y con cuántos datos. */
function ThresholdCard({ threshold }: { threshold: SecurityThreshold }) {
  const { key, name, value, floor, cap, samples, computed_at, raised } = threshold;
  const format = (v: number) => formatThreshold(key, v);
  return (
    <li className={`threshold ${raised ? 'threshold--raised' : ''}`.trim()}>
      <div className="threshold__head">
        <strong>{name}</strong>
        {raised ? (
          <span className="badge badge--success">Endurecido por la plataforma</span>
        ) : (
          <span className="badge badge--muted">En el mínimo</span>
        )}
      </div>
      <span className="threshold__value">{format(value)}</span>
      <RangeMeter value={value} min={floor} max={cap} label={`${name}: ${format(value)}`} format={format} tone={raised ? 'success' : 'primary'} />
      <p className="muted small">
        {count(samples, 'intento medido', 'intentos medidos')} · {computed_at ? `calculado ${formatDateTime(computed_at)}` : 'aún sin calcular'}
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
  const rule = `Con ${count(minAttacks, 'intento sospechoso', 'intentos sospechosos')} en ${windowMinutes} min, los retos de la empresa piden el máximo de movimientos hasta que la ventana quede limpia.`;
  if (companies.length === 0) {
    return <EmptyState compact tone="success" icon={<ShieldCheck />} title="Ninguna empresa bajo ataque" description={rule} />;
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
                <small className="muted">Retos reforzados</small>
              </span>
              <span className="badge badge--danger">{count(company.attacks, 'intento', 'intentos')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Estado del destello: listo para exigirlo o qué falta (para la sección y su insignia). */
export function FlashReadinessBadge({ overview }: { overview: FaceSecurityOverview }) {
  const { ready } = flashReadiness(overview);
  return <span className={`badge ${ready ? 'badge--success' : 'badge--warning'}`}>{ready ? 'Listo para exigirlo' : 'Calibrando'}</span>;
}

const decimal = (value: number | null) => formatThreshold('FLASH_SCORE', value);

/**
 * Lo medido del destello de colores en los intentos exitosos (modo «Solo medir»), con cuándo es
 * seguro pasar una empresa a «Obligatorio».
 */
export function FlashObservationPanel({ overview }: { overview: FaceSecurityOverview }) {
  const { flash, window_days } = overview;
  const { ready, pending } = flashReadiness(overview);
  const stats = [
    ['Medidos', flash.measured.toLocaleString('es-MX')],
    ['Concluyentes', flash.conclusive.toLocaleString('es-MX')],
    ['Con demasiada luz', flash.inconclusive.toLocaleString('es-MX')],
    ['Respuesta mediana', decimal(flash.score_median)],
    ['Respuesta del 10 % más bajo', decimal(flash.score_p10)],
    ['Intensidad mediana', decimal(flash.magnitude_median)],
  ];
  return (
    <>
      <p className="muted small">
        Intentos exitosos de los últimos {window_days} días. La respuesta mide qué tanto siguió el rostro los colores que pintó la pantalla (1 =
        perfecto); con demasiada luz ambiente el destello casi no se nota y la medición no cuenta.
      </p>
      <dl className="details">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={`callout ${ready ? 'callout--success' : ''}`.trim()}>
        <span className={`icon-tile ${ready ? 'icon-tile--success' : 'icon-tile--warning'}`}>{ready ? <CheckCircle2 size={22} /> : <Hourglass size={22} />}</span>
        <div className="callout__body">
          <strong>{ready ? 'Ya se puede exigir el destello' : 'Aún no conviene exigirlo'}</strong>
          <p className="muted small">
            Pasa una empresa a «Obligatorio» (en su política) cuando haya mediciones concluyentes suficientes, el 10 % de las personas con menor
            respuesta supere el umbral vigente y pocas mediciones tengan demasiada luz. Mientras tanto, déjala en «Solo medir»: no bloquea a nadie.
          </p>
          {pending.length > 0 && (
            <ul className="small">
              {pending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
