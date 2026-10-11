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
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

/** Antes de enviar: de quién es la cuenta y que sus sesiones se cerrarán. */
function resetConfirm(validator: Validator): ConfirmInput {
  return {
    tone: 'warning',
    icon: <KeyRound size={30} />,
    eyebrow: t('validators.password.title'),
    title: t('validators.password.confirm.title', { name: validator.name }),
    message: t('validators.password.confirm.message'),
    details: [{ label: t('validators.password.confirm.account'), value: validator.email }],
    note: t('validators.password.confirm.note'),
    confirmLabel: t('validators.password.title'),
    confirmIcon: <KeyRound size={18} />,
  };
}

const loadError = () => t('validators.loadError');
const resetError = () => t('validators.password.error');
/** El aviso al terminar (se arma al dibujarse: sigue al idioma activo). */
const resetDone = () => t('validators.password.done');
const resetDoneText = (email: string) => () => t('validators.password.doneText', { email });

/** Contraseña nueva para la cuenta de un validador (se escribe dos veces; cierra sus sesiones). */
export function ValidatorPasswordPage() {
  const t = useT();
  const validatorId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useNewPassword();
  const { data: validator, error, retry } = useResource((signal) => validatorService.get(validatorId, signal), validatorId, loadError);
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
        void feedback.success(resetDone, resetDoneText(saved.email));
        back();
      },
      resetError,
      // Lo que el servidor rechace de la contraseña (largo, filtrada) se marca en su campo, además del popup.
      { confirm: () => resetConfirm(validator), onError: form.showServerError },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void submit(e)}>
        <PanelHeader title={t('validators.password.title')} subtitle={`${validator.name} · ${validator.email}`} backTo={paths.company.validators} backLabel={t('validators.back')} />
        <PanelSection title={t('validators.password.section')} icon={<KeyRound size={20} />}>
          <p className="muted">{t('validators.password.intro')}</p>
          <div className="form-grid">
            <NewPasswordFields form={form} disabled={saving} />
          </div>
        </PanelSection>
        <FormFooter submitLabel={t('validators.password.submit')} submitIcon={<KeyRound size={18} />} saving={saving} disabled={!form.valid} onCancel={back} />
      </Panel>
    </div>
  );
}
