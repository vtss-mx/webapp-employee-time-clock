import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { validatePassword, validatePasswordConfirm } from '../utils/validation';
import { ConfirmPasswordField, FormField } from './FormField';

/**
 * Contraseña que se asigna (inicial o nueva) escrita dos veces: valores, errores visibles al salir
 * de cada campo y si ya es válida. La confirmación nunca se envía al backend.
 */
export function useNewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const errors = { password: validatePassword(password), confirm: validatePasswordConfirm(password, confirm) };
  return {
    password,
    confirm,
    setPassword,
    setConfirm,
    valid: !errors.password && !errors.confirm,
    shown: { password: touched.password ? errors.password : undefined, confirm: touched.confirm ? errors.confirm : undefined },
    touch: (field: 'password' | 'confirm') => setTouched((t) => ({ ...t, [field]: true })),
  };
}

export type NewPassword = ReturnType<typeof useNewPassword>;

/** Los dos campos de la contraseña que se asigna (formularios de alta y de restablecer). */
export function NewPasswordFields({ form, label = 'Contraseña nueva', disabled = false }: { form: NewPassword; label?: string; disabled?: boolean }) {
  return (
    <>
      <FormField
        label={label}
        icon={<KeyRound size={18} />}
        type="password"
        autoComplete="new-password"
        required
        disabled={disabled}
        value={form.password}
        error={form.shown.password}
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
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
