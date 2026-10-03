import { KeyRound, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { ApiError } from '../services/apiClient';
import { authService } from '../services/authService';
import { validatePassword, validatePasswordConfirm } from '../utils/validation';
import { ConfirmPasswordField, FormField } from './FormField';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';

type Field = 'current' | 'next' | 'confirm';
const EMPTY: Record<Field, string> = { current: '', next: '', confirm: '' };

function validate(values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {
    current: values.current ? undefined : 'Escribe tu contraseña actual',
    next: validatePassword(values.next) ?? (values.next === values.current ? 'Debe ser distinta de la actual' : undefined),
    confirm: validatePasswordConfirm(values.next, values.confirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

/** Errores del servidor llevados al campo correspondiente. */
function serverErrors(err: unknown): Partial<Record<Field, string>> {
  if (!(err instanceof ApiError)) return {};
  if (err.code === 'CURRENT_PASSWORD_INVALID') return { current: err.message };
  if (err.code === 'PASSWORD_REUSED') return { next: err.message };
  const field = err.fieldErrors.new_password;
  return field ? { next: field } : {};
}

/** Sección "Cambiar contraseña" (Mi perfil). Al guardar, se cierran las sesiones de otros dispositivos. */
export function ChangePasswordSection({ onChanged }: { onChanged?: () => void }) {
  const feedback = useFeedback();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [saving, setSaving] = useState(false);
  // El botón se habilita solo con los tres campos correctos; cada error se ve al salir del campo.
  const live = validate(values);
  const canSubmit = Object.keys(live).length === 0 && !saving;

  const bind = (field: Field) => ({
    value: values[field],
    error: errors[field] ?? (touched[field] ? live[field] : undefined),
    disabled: saving,
    required: true,
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
    onChange: (e: { target: { value: string } }) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors(({ [field]: _, ...rest }) => rest); // el error del servidor se descarta al corregir
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      void feedback.invalidForm(found);
      return;
    }
    setSaving(true);
    try {
      const { revoked_sessions: revoked } = await authService.changePassword(values.current, values.next);
      void feedback.success(
        'Contraseña actualizada',
        revoked ? `Se cerró la sesión en ${revoked} dispositivo(s) más.` : 'Tu sesión actual sigue activa.',
      );
      setValues(EMPTY);
      setTouched({});
      onChanged?.();
    } catch (err) {
      const mapped = serverErrors(err);
      setErrors(mapped); // el campo queda marcado y el motivo se explica en el popup
      void feedback.fromError(err, { title: 'No se pudo cambiar la contraseña' });
    } finally {
      setSaving(false);
    }
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
