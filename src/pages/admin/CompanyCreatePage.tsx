import { Blocks, Building2, KeyRound, Plus, UserCog } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanSection } from '../../components/billing/PlanSection';
import { CompanyAdminFields, CompanyDataFields } from '../../components/CompanyForm';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import type { MessageInput } from '../../components/MessageDialog';
import { Switch } from '../../components/ui/Switch';
import { useCatalogs } from '../../hooks/useCatalogs';
import { companyLabels, companyView, useCompanyForm } from '../../hooks/useCompanyForm';
import { usePlanForm } from '../../hooks/usePlanForm';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { emptyPlanForm, planLabels, planView, previewHeadcount, type PlanFormValues } from '../../utils/billing';
import type { CatalogApi } from '../../utils/catalogs';
import { describeValues } from '../../utils/changes';
import { config } from '../../utils/config';
import { adminService } from '../../services/adminService';
import type { CompanyDetail, CompanyFormValues } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDate } from '../../utils/format';

/*
 * Los textos de la confirmación y de los avisos se arman al dibujarse (con el `t` global): un popup
 * abierto sigue al idioma activo.
 */
const createError = () => t('admin.create.error');
/** En el alta la empresa aún no tiene a nadie: la vista previa del cobro sale de sus límites. */
const NOBODY = { employees: 0, validators: 0 };

/**
 * Lo que se registrará: los datos capturados (sin la contraseña; el identificador fiscal con su tipo, su número y su
 * país), el módulo de Integraciones y el plan.
 */
function createConfirm(values: CompanyFormValues, apiEnabled: boolean, plan: PlanFormValues, catalogs: CatalogApi): ConfirmInput {
  return {
    kind: 'create',
    icon: <Building2 size={30} />,
    title: t('admin.create.confirmTitle', { name: values.name.trim() }),
    message: t('admin.create.confirmMessage'),
    detailsTitle: t('admin.shared.willRegister'),
    details: [
      ...describeValues(companyView(values, catalogs), companyLabels()),
      { label: t('admin.shared.api'), value: apiEnabled ? t('common.values.yes') : t('common.values.no') },
      ...describeValues(planView(plan, catalogs.nameOf), planLabels()),
    ],
    note: t('admin.shared.sharePassword'),
    confirmLabel: t('admin.shared.registerCompany'),
    confirmIcon: <Plus size={18} />,
  };
}

/** Aviso del alta: con qué correo entra su administrador, qué se creó y qué sigue. */
function createdNotice(company: CompanyDetail, email: string, startsOn: string): MessageInput {
  return {
    variant: 'success',
    title: t('admin.create.done.title'),
    text: t('admin.create.done.text', { name: company.name, app: config.appName }),
    details: [
      t('admin.create.done.adminLogin', { email }),
      t('admin.create.done.policy'),
      company.api_enabled ? t('admin.create.done.apiOn') : t('admin.create.done.apiOff'),
      company.max_validators > 0 ? t('admin.create.done.validatorsOn', { count: company.max_validators }) : t('admin.create.done.validatorsOff'),
      t('admin.create.done.billing', { date: formatDate(startsOn) }),
      t('admin.create.done.next'),
    ],
    detailsStyle: 'checks',
  };
}

/** Alta de empresa con su primer administrador (cuenta con la que la empresa entra a la plataforma). */
export function CompanyCreatePage() {
  const t = useT();
  const navigate = useNavigate();
  const form = useCompanyForm({ withAdmin: true });
  const catalogs = useCatalogs();
  // Plan de cobro: siempre se envía con el alta (el precio es obligatorio).
  const plan = usePlanForm(emptyPlanForm());
  const canSubmit = form.canSubmit && plan.valid;
  // Integraciones (API) es un módulo que el ADMIN concede: por omisión la empresa no lo tiene.
  const [apiEnabled, setApiEnabled] = useState(false);
  const fieldProps = { values: form.values, errors: form.errors, onChange: form.setValues, onTouch: form.touch, live: form.live, disabled: form.saving };

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      plan.touchAll(); // lo que falta del plan se ve en sus campos
      return;
    }
    await form.save(async () => {
      // Un rechazo del plan (422 por campo) queda marcado en sus campos; el popup explica el motivo.
      const company = await adminService.create(form.values, apiEnabled, plan.input).catch((error: unknown) => {
        plan.fail(error);
        throw error;
      });
      void navigate(paths.admin.company(company.id), { replace: true });
      const email = form.values.admin_email.trim().toLowerCase();
      void form.feedback.show(() => createdNotice(company, email, plan.values.starts_on));
    }, createError, () => createConfirm(form.values, apiEnabled, plan.values, catalogs));
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title={t('admin.shared.registerCompany')} backTo={paths.admin.companies} backLabel={t('admin.shared.companies')} />
        <PanelSection title={t('admin.shared.companyData')} icon={<Building2 size={20} />}>
          <CompanyDataFields {...fieldProps} />
        </PanelSection>
        <PanelSection title={t('admin.create.adminSection')} icon={<UserCog size={20} />}>
          <CompanyAdminFields {...fieldProps} />
        </PanelSection>
        <PlanSection form={plan} headcount={previewHeadcount(NOBODY, { employees: form.values.max_employees, validators: form.values.max_validators })} disabled={form.saving} />
        <PanelSection title={t('admin.shared.modules')} icon={<Blocks size={20} />}>
          <Switch
            checked={apiEnabled}
            onChange={setApiEnabled}
            icon={<KeyRound size={20} />}
            label={t('admin.shared.api')}
            description={t('admin.create.apiDescription')}
            disabled={form.saving}
          />
        </PanelSection>
        <PanelFooter>
          <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={form.saving}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={form.saving}
            disabled={!canSubmit}
            title={canSubmit ? undefined : t('admin.shared.incomplete')}
            icon={<Plus size={20} />}
          >
            {t('admin.shared.registerCompany')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
