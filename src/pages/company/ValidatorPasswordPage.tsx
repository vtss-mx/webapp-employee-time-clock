import { KeyRound } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormFooter } from '../../components/FormFooter';
import { NewPasswordFields, useNewPassword } from '../../components/NewPasswordFields';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useSubmit } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';

/** Contraseña nueva para la cuenta de un validador (se escribe dos veces; cierra sus sesiones). */
export function ValidatorPasswordPage() {
  const validatorId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useNewPassword();
  const { data: validator, error, retry } = useResource((signal) => validatorService.get(validatorId, signal), validatorId, 'No se pudo cargar el validador');
  const { saving, submit: send } = useSubmit();

  const back = () => void navigate(paths.company.validators);

  if (!validator) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;

  // Pregunta antes de enviar (cerrará sus sesiones); cancelar deja el formulario como estaba.
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!form.valid) return;
    await send(
      async () => {
        const saved = await validatorService.resetPassword(validatorId, form.password);
        void feedback.success('Contraseña restablecida', `${saved.email} debe iniciar sesión de nuevo: sus sesiones abiertas se cerraron.`);
        back();
      },
      'No se pudo restablecer la contraseña',
      {
        confirm: {
          tone: 'warning',
          icon: <KeyRound size={30} />,
          eyebrow: 'Restablecer contraseña',
          title: `¿Restablecer la contraseña de ${validator.name}?`,
          message: 'Deberá iniciar sesión con la contraseña nueva: compártela por un medio seguro.',
          details: [{ label: 'Cuenta', value: validator.email }],
          note: 'Sus sesiones abiertas se cerrarán de inmediato.',
          confirmLabel: 'Restablecer contraseña',
          confirmIcon: <KeyRound size={18} />,
        },
      },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader title="Restablecer contraseña" subtitle={`${validator.name} · ${validator.email}`} backTo={paths.company.validators} backLabel="Validadores" />
        <PanelSection title="Contraseña nueva" icon={<KeyRound size={20} />}>
          <p className="muted">Asigna una contraseña nueva y compártela por un medio seguro. Se cerrarán sus sesiones abiertas.</p>
          <div className="form-grid">
            <NewPasswordFields form={form} disabled={saving} />
          </div>
        </PanelSection>
        <FormFooter submitLabel="Restablecer" submitIcon={<KeyRound size={18} />} saving={saving} disabled={!form.valid} onCancel={back} />
      </Panel>
    </div>
  );
}
