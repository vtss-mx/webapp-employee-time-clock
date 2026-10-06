import { Calculator, CircleAlert, Receipt } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { PlanForm } from '../../hooks/usePlanForm';
import { usePlanPreview, type PreviewState } from '../../hooks/usePlanPreview';
import { useT } from '../../i18n';
import type { ChargePreview, CurrencyCode, PlanPreview, PricingMode } from '../../types';
import { currencyText, headcountText, periodText, unitsText, type PreviewHeadcount } from '../../utils/billing';
import { formatDate } from '../../utils/format';
import { formatMoney } from '../../utils/numbers';
import { EmptyState } from '../ui/EmptyState';
import { PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { MoneyRows, totalsRows } from './MoneyRows';
import { PlanFields } from './PlanFields';

interface PreviewChargeProps {
  title: string;
  charge: ChargePreview | null;
  mode: PricingMode;
  currency: CurrencyCode;
  empty?: string;
}

/** Un cargo de la vista previa: su periodo, lo que se cobra y sus totales (en la moneda del plan). */
function PreviewCharge({ title, charge, mode, currency, empty }: PreviewChargeProps) {
  const t = useT();
  return (
    <article className="plan-preview__card">
      <header>
        <h4>{title}</h4>
        {charge && <span className="badge badge--plain badge--info">{t('billing.charges.name', { sequence: charge.sequence })}</span>}
      </header>
      {charge ? (
        <>
          <p className="muted">{t('billing.preview.period', { period: periodText(charge.period_start, charge.period_end), date: formatDate(charge.cut_on) })}</p>
          <p className="plan-preview__units">{t('billing.preview.units', { days: t('billing.preview.billableDays', { count: charge.billable_days }), units: unitsText(charge.units, mode, charge.validator_units) })}</p>
          <MoneyRows rows={totalsRows(charge)} currency={currency} label={t('billing.preview.totalsOf', { title })} />
        </>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </article>
  );
}

/** Lo que el backend calculó: el primer cargo, cada periodo después y el equivalente mensual, en la moneda del plan. */
function PreviewCards({ preview, mode, loading }: { preview: PlanPreview; mode: PricingMode; loading: boolean }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { currency } = preview;
  return (
    <div className={`plan-preview ${loading ? 'is-loading' : ''}`.trim()} aria-busy={loading}>
      <p className="plan-preview__currency">{t('billing.preview.currency', { currency: currencyText(currency, nameOf) })}</p>
      {preview.trial_ends_on && <p className="badge badge--info plan-preview__trial">{t('billing.preview.trialUntil', { date: formatDate(preview.trial_ends_on) })}</p>}
      <div className="plan-preview__cards">
        <PreviewCharge title={t('billing.preview.first')} charge={preview.first} mode={mode} currency={currency} empty={t('billing.preview.firstIsTrial')} />
        <PreviewCharge title={t('billing.preview.recurring')} charge={preview.recurring} mode={mode} currency={currency} />
      </div>
      <p className="plan-preview__monthly">
        {t('billing.preview.monthly')} <strong>{formatMoney(preview.monthly_equivalent, currency)}</strong> <span className="muted">{t('billing.withTax')}</span>
      </p>
    </div>
  );
}

/** Estado de la vista previa: sin plan completo, rechazado mientras se escribe, falla, calculando o lista. */
function PreviewBody({ state, retry, mode }: { state: PreviewState; retry: () => void; mode: PricingMode }): ReactNode {
  const t = useT();
  switch (state.status) {
    case 'idle':
      return <EmptyState compact icon={<Calculator />} title={t('billing.preview.idleTitle')} description={t('billing.preview.idleDescription')} />;
    case 'invalid':
      return <EmptyState compact icon={<CircleAlert />} title={t('billing.preview.invalidTitle')} description={state.message} />;
    case 'error':
      return <RetryState onRetry={retry} label={t('billing.preview.retry')} />;
    case 'loading':
      return state.preview ? <PreviewCards preview={state.preview} mode={mode} loading /> : <SkeletonCard lines={4} />;
    default:
      return <PreviewCards preview={state.preview} mode={mode} loading={false} />;
  }
}

/** Sin empleados ni validadores: la vista previa de un monto fijo. */
const NOBODY = { employees: 0, validators: 0 };

interface PlanSectionProps {
  form: PlanForm;
  /** Empleados y validadores activos con que se simula el cobro por empleado y de dónde salen (`previewHeadcount`). */
  headcount: PreviewHeadcount;
  disabled?: boolean;
  /** La empresa ya tiene cargos o pagos: la moneda no se puede cambiar. */
  currencyLocked?: boolean;
  /** Contenido sobre los campos (p. ej. el interruptor "Cobrar a esta empresa" al editar sin plan). */
  intro?: ReactNode;
  /** Sin plan que capturar (editar una empresa sin plan con el cobro apagado): solo `intro`. */
  hidden?: boolean;
}

/**
 * Sección "Plan y cobro" del alta y la edición de una empresa: los campos del plan (con su moneda) y, al
 * lado, la vista previa del cobro que calcula el backend mientras se escribe (si se cobra por empleado, con los
 * empleados que ya se saben de la empresa: sin un campo aparte), en la moneda elegida. La vista previa nunca impide
 * guardar.
 */
export function PlanSection({ form, headcount, disabled = false, currencyLocked = false, intro, hidden = false }: PlanSectionProps) {
  const t = useT();
  const mode = form.values.pricing_mode;
  // Monto fijo: no depende de quiénes estén activos (se pide con nadie: la misma vista para cualquier plantilla).
  const { state, retry } = usePlanPreview(hidden ? null : form.input, mode === 'PER_USER' ? headcount : NOBODY);
  return (
    <PanelSection title={t('billing.plan.sectionTitle')} icon={<Receipt size={20} />}>
      {intro}
      {!hidden && (
        <div className="plan-section">
          <PlanFields form={form} disabled={disabled} currencyLocked={currencyLocked} />
          <aside className="plan-preview-box" aria-label={t('billing.preview.title')}>
            <h3 className="plan-preview-box__title">{t('billing.preview.title')}</h3>
            {mode === 'PER_USER' && (
              <p className="plan-preview-box__basis">
                {headcountText(headcount)}
                {headcount.validators > 0 && <> · {t('billing.preview.validatorsNote')}</>}
              </p>
            )}
            <PreviewBody state={state} retry={retry} mode={mode} />
          </aside>
        </div>
      )}
    </PanelSection>
  );
}
