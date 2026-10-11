import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../i18n';
import { fieldErrorsFrom } from '../services/apiClient';
import { passwordErrorFields, validatePassword, validatePasswordConfirm } from '../utils/validation';
import { ConfirmPasswordField, FormField } from './FormField';

/** El rechazo del servidor sobre la contraseña (largo, filtrada, reciclada) como error de ESE campo. */
function serverPasswordError(error: unknown): string | undefined {
  return fieldErrorsFrom<{ password: string }>(error, passwordErrorFields<{ password: string }>('password')).password;
}

/**
 * Contraseña que se asigna (inicial o nueva) escrita dos veces: valores, errores visibles al salir
 * de cada campo y si ya es válida. La confirmación nunca se envía al backend.
 *
 * `showServerError` lleva al CAMPO lo que el servidor rechazó (`PASSWORD_TOO_SHORT`, `PASSWORD_BREACHED`,
 * `PASSWORD_REUSED`): el popup explica la falla, pero lo que hay que corregir se marca donde se escribe. Al
 * cambiar la contraseña ese error se descarta (ya no corresponde a lo escrito).
 */
export function useNewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [server, setServer] = useState<string | undefined>(undefined);
  const errors = { password: validatePassword(password), confirm: validatePasswordConfirm(password, confirm) };
  return {
    password,
    confirm,
    setPassword: (value: string) => {
      setServer(undefined);
      setPassword(value);
    },
    setConfirm,
    valid: !errors.password && !errors.confirm,
    shown: { password: server ?? (touched.password ? errors.password : undefined), confirm: touched.confirm ? errors.confirm : undefined },
    touch: (field: 'password' | 'confirm') => setTouched((t) => ({ ...t, [field]: true })),
    /** Marca el campo con lo que el servidor rechazó (sin código conocido, no marca nada). */
    showServerError: (error: unknown) => setServer(serverPasswordError(error)),
  };
}

export type NewPassword = ReturnType<typeof useNewPassword>;

/** Los dos campos de la contraseña que se asigna (formularios de alta y de restablecer). */
export function NewPasswordFields({ form, label, disabled = false }: { form: NewPassword; label?: string; disabled?: boolean }) {
  const t = useT();
  return (
    <>
      <FormField
        label={label ?? t('auth.password.new')}
        icon={<KeyRound size={18} />}
        type="password"
        autoComplete="new-password"
        required
        disabled={disabled}
        value={form.password}
        error={form.shown.password}
        hint={t('auth.password.hint')}
        onBlur={() => form.touch('password')}
        onChange={(e) => form.setPassword(e.target.value)}
      />
      <ConfirmPasswordField
        required
        disabled={disabled}
        value={form.confirm}
        error={form.shown.confirm}
        onBlur={() => form.touch('confirm')}
        onChange={(e) => form.setConfirm(e.target.value)}
      />
    </>
  );
}
