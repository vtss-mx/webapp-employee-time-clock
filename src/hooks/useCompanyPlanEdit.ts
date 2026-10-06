import { useLayoutEffect, useState } from 'react';
import { t } from '../i18n';
import { billingService } from '../services/billingService';
import { emptyPlanForm, planChanged, planFormFrom, planLabels, planView } from '../utils/billing';
import { describeChanges } from '../utils/changes';
import { useCatalogs } from './useCatalogs';
import { usePlanForm } from './usePlanForm';
import { useResource } from './useResource';

const loadError = () => t('billing.plan.loadError');

/**
 * El plan de cobro al editar una empresa: se carga de su cuenta de cobranza (`GET
 * /admin/billing/companies/{id}`; puede no tener plan: entonces "Cobrar a esta empresa" lo habilita) y
 * dice qué cambió ("antes → después" con los textos del plan) y qué se guardaría (`toSave`, solo si
 * cambió). Sin plan, la moneda empieza en la de la cuenta si ya tiene movimientos (queda fija en ella).
 * Si la cuenta no carga, la empresa se sigue editando: el plan queda fuera hasta reintentar.
 */
export function useCompanyPlanEdit(companyId: number) {
  const { nameOf } = useCatalogs();
  const account = useResource((signal) => billingService.account(companyId, signal), companyId, loadError);
  const saved = account.data?.plan ?? null;
  const accountCurrency = account.data?.currency ?? null;
  const form = usePlanForm(emptyPlanForm());
  const [charging, setCharging] = useState(false);
  const { load, set } = form;
  // El plan guardado llena los campos en cuanto llega (antes de pintarse); sin plan, la moneda de la cuenta.
  useLayoutEffect(() => {
    if (saved) load(planFormFrom(saved));
    else if (accountCurrency) set('currency', accountCurrency);
  }, [saved, accountCurrency, load, set]);

  const editable = account.data !== null && (saved !== null || charging);
  const changed = editable && form.valid && planChanged(saved, form.values);
  return {
    account,
    form,
    saved,
    /** Hay plan que capturar (ya tenía uno, o se encendió "Cobrar a esta empresa"). */
    editable,
    charging,
    setCharging,
    /** El plan no impide guardar (fuera de edición no cuenta). */
    valid: !editable || form.valid,
    /** Lo que se enviaría con `PUT .../plan` (null si el plan no cambió). */
    toSave: changed ? form.input : null,
    /** "Antes → después" del plan: se piden al armar la confirmación (siguen al idioma activo). */
    changes: () => (changed ? describeChanges(planView(saved ? planFormFrom(saved) : null, nameOf), planView(form.values, nameOf), planLabels()) : []),
  };
}

export type CompanyPlanEdit = ReturnType<typeof useCompanyPlanEdit>;
