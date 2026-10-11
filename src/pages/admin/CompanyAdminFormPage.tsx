import { KeyRound, UserCog, UserPlus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../components/FormField';
import { NewPasswordFields, useNewPassword } from '../../components/NewPasswordFields';
import { FormFooter } from '../../components/FormFooter';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useSubmit } from '../../hooks/useAction';
import { availabilityBlocks, liveFeedback, useAvailability } from '../../hooks/useAvailability';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import { ApiError } from '../../services/apiClient';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { validateEmail } from '../../utils/validation';

/** Cada pantalla: agregar un administrador o restablecer la contraseña de uno (sus textos en `admin.adminForm.<modo>`). */
const MODES = {
  add: { key: 'add', Icon: UserPlus },
  reset: { key: 'reset', Icon: KeyRound },
} as const;

/** Agregar un administrador: con qué correo entrará y a qué empresa (la contraseña nunca se muestra). */
function addConfirm(company: CompanyDetail, email: string): ConfirmInput {
  return {
    kind: 'create',
    icon: <UserPlus size={30} />,
    title: t('admin.adminForm.addTitle', { email }),
    message: t('admin.adminForm.addMessage'),
    detailsTitle: t('admin.shared.willRegister'),
    details: [
      { label: t('admin.shared.email'), value: email },
      { label: t('common.fields.company'), value: company.name },
    ],
    note: t('admin.shared.sharePassword'),
    confirmLabel: t('admin.adminForm.add.title'),
    confirmIcon: <UserPlus size={18} />,
  };
}

/** Restablecer la contraseña de un administrador: la anterior deja de servir y se cierran sus sesiones. */
function resetConfirm(company: CompanyDetail, admin: CompanyAdmin): ConfirmInput {
  return {
    tone: 'warning',
    icon: <KeyRound size={30} />,
    eyebrow: t('admin.adminForm.resetEyebrow'),
    title: t('admin.adminForm.resetTitle', { email: admin.email }),
    message: t('admin.adminForm.resetMessage'),
    details: [
      { label: t('admin.adminForm.admin'), value: admin.email },
      { label: t('common.fields.company'), value: company.name },
    ],
    note: t('admin.adminForm.resetNote'),
    confirmLabel: t('admin.adminForm.reset.title'),
    confirmIcon: <KeyRound size={18} />,
  };
}

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('admin.shared.loadCompanyError');
const saveError = (mode: 'add' | 'reset') => () => t(`admin.adminForm.${mode}.error`);
const resetDone = () => t('admin.adminForm.resetDone');
const resetDoneText = (email: string) => () => t('admin.adminForm.resetDoneText', { email });
const added = () => t('admin.adminForm.added');
const addedText = (email: string) => () => t('admin.adminForm.addedText', { email });

/**
 * Administradores de una empresa (consola de la plataforma):
 * /admin/companies/:id/admins/new (correo único y contraseña inicial) o
 * /admin/companies/:id/admins/:adminId/password (contraseña nueva: cierra sus sesiones).
 */
export function CompanyAdminFormPage() {
  const params = useParams();
  const companyId = Number(params.id);
  const adminId = params.adminId ? Number(params.adminId) : null;
  const { data, error, retry } = useResource(
    (signal) => Promise.all([adminService.get(companyId, signal), adminId ? adminService.admin(companyId, adminId, signal) : null]),
    `${companyId}:${adminId ?? 'new'}`,
    loadError,
  );

  if (!data) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return <CompanyAdminForm company={data[0]} admin={data[1]} />;
}

function CompanyAdminForm({ company, admin }: { company: CompanyDetail; admin: CompanyAdmin | null }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const mode = admin ? MODES.reset : MODES.add;
  const password = useNewPassword();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const { saving, submit: send } = useSubmit();
  const availability = useAvailability('company_admin_email', email, { enabled: !admin && !validateEmail(email) });
  const live = liveFeedback(availability);
  const emailError = serverError ?? (touched ? validateEmail(email) : undefined) ?? live.error;
  const emailReady = Boolean(admin) || (!validateEmail(email) && !availabilityBlocks(availability));
  const canSubmit = emailReady && password.valid && !saving;

  const back = () => void navigate(paths.admin.company(company.id));
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await send(
      async () => {
        if (admin) {
          await adminService.resetAdminPassword(company.id, admin.id, password.password);
          void feedback.success(resetDone, resetDoneText(admin.email));
        } else {
          await adminService.addAdmin(company.id, email, password.password);
          void feedback.success(added, addedText(email.trim().toLowerCase()));
        }
        back();
      },
      saveError(mode.key),
      {
        confirm: admin ? () => resetConfirm(company, admin) : () => addConfirm(company, email.trim().toLowerCase()),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setServerError(err.message);
          // Lo que el servidor rechace de la contraseña (largo, filtrada, reciclada) se marca en su campo.
          password.showServerError(err);
        },
      },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader
          title={t(`admin.adminForm.${mode.key}.title`)}
          subtitle={admin ? `${admin.email} · ${company.name}` : company.name}
          backTo={paths.admin.company(company.id)}
          backLabel={company.name}
        />
        <PanelSection title={t(`admin.adminForm.${mode.key}.section`)} icon={<mode.Icon size={20} />}>
          {admin && <p className="muted">{t('admin.adminForm.resetHint')}</p>}
          <div className="form-grid">
            {!admin && (
              <FormField
                label={t('admin.form.adminEmail')}
                icon={<UserCog size={18} />}
                type="email"
                inputMode="email"
                autoComplete="off"
                required
                disabled={saving}
                value={email}
                error={emailError}
                status={live.status}
                hint={t('admin.adminForm.emailHint')}
                onBlur={() => setTouched(true)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setServerError(undefined);
                }}
              />
            )}
            <NewPasswordFields form={password} label={t(`admin.adminForm.${mode.key}.password`)} disabled={saving} />
          </div>
        </PanelSection>
        <FormFooter
          submitLabel={t(`admin.adminForm.${mode.key}.action`)}
          submitIcon={<mode.Icon size={18} />}
          saving={saving}
          disabled={!canSubmit}
          disabledTitle={t('admin.shared.incomplete')}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
