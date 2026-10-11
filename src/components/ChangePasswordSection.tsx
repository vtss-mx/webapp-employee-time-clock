import { KeyRound, Save } from 'lucide-react';
import type { ChangeEvent, SubmitEvent } from 'react';
import { useFormState } from '../hooks/useFormState';
import { t, useT } from '../i18n';
import { fieldErrorsFrom } from '../services/apiClient';
import { authService } from '../services/authService';
import { passwordErrorFields, validatePassword, validatePasswordConfirm, type FieldErrors } from '../utils/validation';
import { ConfirmPasswordField, FormField } from './FormField';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';

interface PasswordValues {
  current: string;
  next: string;
  confirm: string;
}
type Field = keyof PasswordValues;
const EMPTY: PasswordValues = { current: '', next: '', confirm: '' };

/** Reglas del cliente, con sus mensajes en el idioma activo (se calculan al dibujar). */
function validate(values: PasswordValues): FieldErrors<PasswordValues> {
  const errors: FieldErrors<PasswordValues> = {
    current: values.current ? undefined : t('profile.password.currentRequired'),
    next: validatePassword(values.next) ?? (values.next === values.current ? t('profile.password.mustDiffer') : undefined),
    confirm: validatePasswordConfirm(values.next, values.confirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

/** Errores del servidor llevados al campo correspondiente. */
const serverErrors = (err: unknown) =>
  fieldErrorsFrom<PasswordValues>(err, { CURRENT_PASSWORD_INVALID: 'current', ...passwordErrorFields<PasswordValues>('next') });

/** Sección "Cambiar contraseña" (Mi perfil). Al guardar, se cierran las sesiones de otros dispositivos. */
export function ChangePasswordSection({ onChanged }: { onChanged?: () => void }) {
  // Redibuja al cambiar el idioma. Los textos salen de `t` (el idioma activo al llamarse), también los
  // de los popups, que se arman al dibujarse: una función creada ahora no se queda con el idioma de hoy.
  useT();
  // La sección sigue en pantalla al guardar: el formulario se vacía y el botón se libera.
  const form = useFormState(EMPTY, { serverErrors, staysOpen: true });
  const { values, saving } = form;
  // El botón se habilita solo con los tres campos correctos; cada error se ve al salir del campo.
  const live = validate(values);
  const errors = form.visibleErrors(live);
  const canSubmit = Object.keys(live).length === 0 && !saving;

  const bind = (field: Field) => ({
    value: values[field],
    error: errors[field],
    disabled: saving,
    required: true,
    onBlur: () => form.touch(field),
    // Cambiar el campo descarta el error que el servidor había puesto en él.
    onChange: (e: ChangeEvent<HTMLInputElement>) => form.setValues({ ...values, [field]: e.target.value }),
  });

  // Inválido: marca los campos y resume qué corregir (sin preguntar ni enviar). Los popups se arman
  // al dibujarse: siguen al idioma activo aunque cambie con ellos abiertos.
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    form.saveIfValid(
      () => validate(values),
      async () => {
        const { revoked_sessions: revoked } = await authService.changePassword(values.current, values.next);
        void form.feedback.success(
          () => t('profile.password.changed'),
          () => t('profile.password.revoked', { count: revoked }),
        );
        form.reset();
        onChanged?.();
      },
      () => t('profile.password.failed'),
      () => ({
        kind: 'edit',
        tone: 'warning',
        icon: <KeyRound size={30} />,
        eyebrow: t('profile.password.ask.eyebrow'),
        title: t('profile.password.ask.title'),
        message: t('profile.password.ask.message'),
        details: [t('profile.password.ask.otherDevices'), t('profile.password.ask.thisDevice')],
        confirmLabel: t('profile.password.ask.confirm'),
        confirmIcon: <KeyRound size={18} />,
      }),
    );
  };

  return (
    <PanelSection title={t('profile.password.title')} icon={<KeyRound size={20} />}>
      <form className="stack" onSubmit={submit} noValidate>
        <FormField label={t('profile.password.current')} type="password" autoComplete="current-password" {...bind('current')} />
        <FormField label={t('profile.password.new')} type="password" autoComplete="new-password" hint={t('auth.password.hint')} {...bind('next')} />
        <ConfirmPasswordField label={t('profile.password.confirm')} {...bind('confirm')} />
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!canSubmit}
          title={canSubmit ? undefined : t('profile.password.submitDisabled')}
          icon={<Save size={18} />}
        >
          {t('profile.password.submit')}
        </Button>
      </form>
    </PanelSection>
  );
}
