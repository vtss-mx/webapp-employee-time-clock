import { useT } from '../../i18n';
import { formatNumber } from '../../utils/numbers';
import { CatalogStatusBadge } from '../StatusBadge';

/**
 * Nivel de riesgo (catálogo `risk_tiers`, con su color) y su puntaje: "Alto · 72 pts". Un caso que abrió un candado
 * antes del motor no tiene puntaje: lo dice en gris.
 */
export function RiskBadge({ tier, score }: { tier: string | null; score: number | null }) {
  const t = useT();
  if (!tier) return <span className="badge badge--muted">{t('fraud.risk.none')}</span>;
  return (
    <span className="risk-badge">
      <CatalogStatusBadge catalog="risk_tiers" code={tier} />
      {score !== null && <small className="muted">{t('policy.risk.points', { points: formatNumber(score) })}</small>}
    </span>
  );
}
