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
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import { ApiError } from '../../services/apiClient';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { validateEmail } from '../../utils/validation';

/** Textos de cada pantalla: agregar un administrador o restablecer la contraseña de uno. */
const MODES = {
  add: { title: 'Agregar administrador', Icon: UserPlus, action: 'Agregar', password: 'Contraseña inicial', failed: 'No se pudo agregar el administrador' },
  reset: { title: 'Restablecer contraseña', Icon: KeyRound, action: 'Restablecer', password: 'Contraseña nueva', failed: 'No se pudo restablecer la contraseña' },
} as const;

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
    'No se pudo cargar la empresa',
  );

  if (!data) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return <CompanyAdminForm company={data[0]} admin={data[1]} />;
}

function CompanyAdminForm({ company, admin }: { company: CompanyDetail; admin: CompanyAdmin | null }) {
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
          void feedback.success('Contraseña restablecida', `${admin.email} ya puede entrar con la nueva contraseña. Sus sesiones abiertas se cerraron.`);
        } else {
          await adminService.addAdmin(company.id, email, password.password);
          void feedback.success('Administrador agregado', `${email.trim().toLowerCase()} ya puede iniciar sesión.`);
        }
        back();
      },
      mode.failed,
      (err) => err instanceof ApiError && err.code === 'EMAIL_TAKEN' && setServerError(err.message),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader title={mode.title} subtitle={admin ? `${admin.email} · ${company.name}` : company.name} backTo={paths.admin.company(company.id)} backLabel={company.name} />
        <PanelSection title={admin ? 'Contraseña nueva' : 'Cuenta del administrador'} icon={<mode.Icon size={20} />}>
          {admin && <p className="muted">Asigna una contraseña nueva y compártela por un medio seguro. Se cerrarán sus sesiones abiertas.</p>}
          <div className="form-grid">
            {!admin && (
              <FormField
                label="Correo del administrador"
                icon={<UserCog size={18} />}
                type="email"
                inputMode="email"
                autoComplete="off"
                required
                disabled={saving}
                value={email}
                error={emailError}
                status={live.status}
                hint="Con este correo iniciará sesión"
                onBlur={() => setTouched(true)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setServerError(undefined);
                }}
              />
            )}
            <NewPasswordFields form={password} label={mode.password} disabled={saving} />
          </div>
        </PanelSection>
        <FormFooter
          submitLabel={mode.action}
          submitIcon={<mode.Icon size={18} />}
          saving={saving}
          disabled={!canSubmit}
          disabledTitle="Completa correctamente todos los campos obligatorios"
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
