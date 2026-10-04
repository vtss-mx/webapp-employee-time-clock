import { KeyRound, Save } from 'lucide-react';
import type { ChangeEvent, SubmitEvent } from 'react';
import { useFormState } from '../hooks/useFormState';
import { fieldErrorsFrom } from '../services/apiClient';
import { authService } from '../services/authService';
import { validatePassword, validatePasswordConfirm, type FieldErrors } from '../utils/validation';
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

function validate(values: PasswordValues): FieldErrors<PasswordValues> {
  const errors: FieldErrors<PasswordValues> = {
    current: values.current ? undefined : 'Escribe tu contraseña actual',
    next: validatePassword(values.next) ?? (values.next === values.current ? 'Debe ser distinta de la actual' : undefined),
    confirm: validatePasswordConfirm(values.next, values.confirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

/** Errores del servidor llevados al campo correspondiente. */
const serverErrors = (err: unknown) =>
  fieldErrorsFrom<PasswordValues>(err, { CURRENT_PASSWORD_INVALID: 'current', PASSWORD_REUSED: 'next', new_password: 'next' });

/** Sección "Cambiar contraseña" (Mi perfil). Al guardar, se cierran las sesiones de otros dispositivos. */
export function ChangePasswordSection({ onChanged }: { onChanged?: () => void }) {
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

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (Object.keys(live).length) {
      form.touchAll();
      void form.feedback.invalidForm(live);
      return;
    }
    await form.save(
      async () => {
        const { revoked_sessions: revoked } = await authService.changePassword(values.current, values.next);
        void form.feedback.success('Contraseña actualizada', revoked ? `Se cerró la sesión en ${revoked} dispositivo(s) más.` : 'Tu sesión actual sigue activa.');
        form.reset();
        onChanged?.();
      },
      'No se pudo cambiar la contraseña',
      {
        kind: 'edit',
        tone: 'warning',
        icon: <KeyRound size={30} />,
        eyebrow: 'Seguridad de tu cuenta',
        title: '¿Cambiar tu contraseña?',
        message: 'A partir de ahora entrarás con la nueva contraseña.',
        details: ['Se cerrará tu sesión en tus otros dispositivos.', 'Este dispositivo seguirá con la sesión iniciada.'],
        confirmLabel: 'Cambiar contraseña',
        confirmIcon: <KeyRound size={18} />,
      },
    );
  };

  return (
    <PanelSection title="Cambiar contraseña" icon={<KeyRound size={20} />}>
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <FormField label="Contraseña actual" type="password" autoComplete="current-password" {...bind('current')} />
        <FormField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
          {...bind('next')}
        />
        <ConfirmPasswordField label="Confirmar nueva contraseña" {...bind('confirm')} />
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!canSubmit}
          title={canSubmit ? undefined : 'Completa correctamente todos los campos obligatorios'}
          icon={<Save size={18} />}
        >
          Actualizar contraseña
        </Button>
      </form>
    </PanelSection>
  );
}
