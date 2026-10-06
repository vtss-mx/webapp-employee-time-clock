import { Receipt } from 'lucide-react';
import type { CompanyPlanEdit } from '../../hooks/useCompanyPlanEdit';
import { useT } from '../../i18n';
import type { PreviewHeadcount } from '../../utils/billing';
import { PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { Switch } from '../ui/Switch';
import { PlanSection } from './PlanSection';

interface CompanyPlanEditorProps {
  edit: CompanyPlanEdit;
  /** Con cuántos empleados se simula el cobro por empleado (`previewHeadcount`: los que ya tiene o su límite). */
  headcount: PreviewHeadcount;
  disabled?: boolean;
}

/**
 * "Plan y cobro" al editar una empresa: el plan guardado (o, sin plan, el interruptor para empezar a
 * cobrarle) con su vista previa. Mientras su cuenta carga o si falló, la sección lo dice sin detener
 * la edición de los datos de la empresa.
 */
export function CompanyPlanEditor({ edit, headcount, disabled = false }: CompanyPlanEditorProps) {
  const t = useT();
  const { account } = edit;
  if (!account.data) {
    return (
      <PanelSection title={t('billing.plan.sectionTitle')} icon={<Receipt size={20} />}>
        {account.error ? <RetryState onRetry={account.retry} label={t('billing.plan.loadRetry')} /> : <SkeletonCard lines={3} />}
      </PanelSection>
    );
  }
  const intro = edit.saved ? null : (
    <Switch
      checked={edit.charging}
      onChange={edit.setCharging}
      icon={<Receipt size={20} />}
      label={t('billing.plan.charging')}
      description={t('billing.plan.chargingDescription')}
      disabled={disabled}
    />
  );
  return <PlanSection form={edit.form} headcount={headcount} disabled={disabled} currencyLocked={account.data.currency_locked} intro={intro} hidden={!edit.editable} />;
}
