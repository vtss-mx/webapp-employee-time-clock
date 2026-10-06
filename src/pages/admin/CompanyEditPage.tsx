import { Building2, Save } from 'lucide-react';
import { useLayoutEffect, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyPlanEditor } from '../../components/billing/CompanyPlanEditor';
import { CompanyDataFields } from '../../components/CompanyForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { companyLabels, companyView, emptyCompanyForm, useCompanyForm } from '../../hooks/useCompanyForm';
import { useCompanyPlanEdit } from '../../hooks/useCompanyPlanEdit';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import { billingService } from '../../services/billingService';
import type { CompanyDetail, CompanyFormValues } from '../../types';
import type { ConfirmInput, FieldChange } from '../../types/confirm';
import { previewHeadcount } from '../../utils/billing';
import type { CatalogApi } from '../../utils/catalogs';
import { describeChanges } from '../../utils/changes';
import { taxIdKey } from '../../utils/taxId';

const EDITABLE = ['name', 'legal_name', 'phone', 'max_employees', 'max_validators'] as const;
/** El identificador fiscal viaja completo: sus tres datos juntos (el backend ignora país y tipo sin número). */
const TAX_FIELDS = ['tax_country', 'tax_id_type', 'tax_id'] as const;

function toForm(company: CompanyDetail): CompanyFormValues {
  return {
    ...emptyCompanyForm,
    name: company.name,
    legal_name: company.legal_name ?? '',
    // Sin identificador se proponen los mismos que en el alta (México y su RFC).
    tax_country: company.tax_country ?? emptyCompanyForm.tax_country,
    tax_id_type: company.tax_id_type ?? emptyCompanyForm.tax_id_type,
    tax_id: company.tax_id ?? '',
    phone: company.phone ?? '',
    max_employees: company.max_employees ? String(company.max_employees) : '',
    max_validators: String(company.max_validators),
  };
}

/**
 * Lo que cambió: cada dato distinto y, si cambió el identificador fiscal (su país, su tipo o su número; sin número el
 * país y el tipo no cuentan), sus tres datos juntos.
 */
function changedFields(initial: CompanyFormValues, values: CompanyFormValues): Partial<CompanyFormValues> {
  const fields = [...EDITABLE.filter((field) => values[field].trim() !== initial[field]), ...(taxIdKey(values) !== taxIdKey(initial) ? TAX_FIELDS : [])];
  return Object.fromEntries(fields.map((field) => [field, values[field]]));
}

/**
 * Confirmación de la edición: "antes → después" de cada dato que cambió, de la empresa (el identificador fiscal con su
 * tipo, su número y su país) y de su plan de cobro (sin cambios, se avisa y no se envía nada). Un cambio del plan
 * aplica desde el próximo cargo.
 */
function editConfirm(company: CompanyDetail, values: CompanyFormValues, planChanges: FieldChange[], catalogs: CatalogApi): ConfirmInput {
  return {
    kind: 'edit',
    icon: <Building2 size={30} />,
    title: t('admin.edit.confirmTitle', { name: company.name }),
    message: t('admin.edit.confirmMessage'),
    changes: [...describeChanges(companyView(toForm(company), catalogs), companyView(values, catalogs), companyLabels()), ...planChanges],
    note: planChanges.length > 0 ? t('admin.edit.planNote') : undefined,
    confirmLabel: t('common.actions.saveChanges'),
    confirmIcon: <Save size={18} />,
  };
}

/** La vista previa del cobro: los empleados y validadores activos que ya tiene o, si no tiene a nadie, sus límites. */
const editHeadcount = (company: CompanyDetail, values: CompanyFormValues) =>
  previewHeadcount({ employees: company.employee_count, validators: company.active_validators }, { employees: values.max_employees, validators: values.max_validators });

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('admin.shared.loadCompanyError');
const saveError = () => t('admin.edit.error');
const saved = () => t('admin.edit.saved');

/** Edición de los datos de la empresa y de su plan de cobro (solo se envía lo que cambió). */
export function CompanyEditPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: original, error: loadFailure, retry: load } = useResource((signal) => adminService.get(companyId, signal), companyId, loadError);
  const minValidators = original?.active_validators ?? 0;
  const catalogs = useCatalogs();
  const form = useCompanyForm({ withAdmin: false, excludeId: companyId, original: original ? toForm(original) : undefined, minValidators });
  const { loadValues } = form;
  // Los campos se llenan con la empresa en cuanto llega (antes de pintarse: sin parpadeo de campos vacíos).
  useLayoutEffect(() => {
    if (original) loadValues(toForm(original));
  }, [original, loadValues]);

  const plan = useCompanyPlanEdit(companyId);

  const initial = original ? toForm(original) : null;
  const changes = initial ? changedFields(initial, form.values) : {};
  const companyDirty = Object.keys(changes).length > 0;
  const planToSave = plan.toSave;
  const dirty = companyDirty || planToSave !== null;
  // Empresa y plan completos (lo que falte se marca; la vista previa del plan nunca bloquea).
  const complete = form.canSubmit && plan.valid;

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    // Sin cambios (p. ej. Enter en un campo) la confirmación avisa "Sin cambios" y no envía nada.
    if (!complete || !original) {
      plan.form.touchAll(); // lo que falta del plan se ve en sus campos
      return;
    }
    await form.save(
      async () => {
        if (companyDirty) await adminService.update(companyId, changes);
        // El plan aplica desde el próximo cargo; un rechazo por campo (422) queda marcado en el plan.
        if (planToSave) {
          await billingService.savePlan(companyId, planToSave).catch((error: unknown) => {
            plan.form.fail(error);
            throw error;
          });
        }
        void form.feedback.success(saved);
        void navigate(paths.admin.company(companyId));
      },
      saveError,
      () => editConfirm(original, form.values, plan.changes(), catalogs),
    );
  };

  if (!original && !loadFailure) return <SkeletonCard lines={6} />;

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title={t('admin.edit.title')} subtitle={original?.name} backTo={paths.admin.company(companyId)} />
        <PanelSection title={t('admin.shared.companyData')} icon={<Building2 size={20} />}>
          {Boolean(loadFailure) && !original && <RetryState onRetry={load} />}
          {original && (
            <CompanyDataFields
              values={form.values}
              errors={form.errors}
              onChange={form.setValues}
              onTouch={form.touch}
              live={form.live}
              disabled={form.saving}
              minValidators={minValidators}
            />
          )}
        </PanelSection>
        {original && <CompanyPlanEditor edit={plan} headcount={editHeadcount(original, form.values)} disabled={form.saving} />}
        {original && (
          <PanelFooter>
            <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={form.saving}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={form.saving}
              disabled={!complete || !dirty}
              title={complete ? (dirty ? undefined : t('admin.edit.noChanges')) : t('admin.shared.incomplete')}
              icon={<Save size={20} />}
            >
              {t('common.actions.saveChanges')}
            </Button>
          </PanelFooter>
        )}
      </Panel>
    </div>
  );
}
