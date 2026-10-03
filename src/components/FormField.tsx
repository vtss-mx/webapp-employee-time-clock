import { CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2 } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import type { AvailabilityState } from '../hooks/useAvailability';

export interface FieldStatus {
  tone: 'checking' | 'success' | 'info';
  text?: string;
}

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  /** Validación en vivo: "verificando…" o confirmación (✓) junto al control. */
  status?: FieldStatus;
  /** Acceso al <input> (p. ej. para enfocarlo cuando llega un dato del servidor). */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * "Confirmar contraseña": toda contraseña que se asigna (alta, restablecer, cambiar) se escribe dos
 * veces. Misma apariencia en todos los formularios; la regla es `validatePasswordConfirm`.
 */
export function ConfirmPasswordField({ label = 'Confirmar contraseña', ...props }: Omit<FormFieldProps, 'label' | 'type'> & { label?: string }) {
  return <FormField label={label} icon={<KeyRound size={18} />} type="password" autoComplete="new-password" {...props} />;
}

export function FormField({ label, error, hint, icon, type, id, status, inputRef, ...inputProps }: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div
      className={`field ${error ? 'field--error' : ''} ${icon ? 'field--with-icon' : ''} ${
        !error && status ? `field--${status.tone}` : ''
      }`}
    >
      <FieldLabel htmlFor={inputId} label={label} required={inputProps.required} />
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          ref={inputRef}
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(inputId, error, hint)}
          {...inputProps}
        />
        {!error && status && (
          <span className="field__status" aria-live="polite" aria-label={status.tone === 'checking' ? 'Verificando' : status.text}>
            <StatusIcon tone={status.tone} />
          </span>
        )}
        {isPassword && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      <FieldMessage id={inputId} error={error} hint={!error && status?.text ? status.text : hint} />
    </div>
  );
}

const STATUS_ICONS = { checking: <Loader2 size={18} className="spin" />, success: <CheckCircle2 size={18} />, info: <Info size={18} /> };

/** Ícono del estado en vivo (verificando, disponible o aviso). */
export function StatusIcon({ tone }: { tone: FieldStatus['tone'] }) {
  return STATUS_ICONS[tone];
}

/**
 * Etiqueta de campo. Si es obligatorio, el asterisco rojo se dibuja con CSS: no forma parte del
 * texto de la etiqueta (ni del nombre accesible ni de lo que lee el autollenado del navegador);
 * el `required` del control ya lo anuncia a los lectores de pantalla.
 */
export function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={required ? 'is-required' : undefined}>
      {label}
    </label>
  );
}

/** Mensaje bajo el control: el error tiene prioridad sobre la ayuda. Compartido por todos los campos. */
export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <small id={`${id}-error`} className="field__error" role="alert">
        {error}
      </small>
    );
  }
  return hint ? (
    <small id={`${id}-hint`} className="field__hint">
      {hint}
    </small>
  ) : null;
}

export const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

/** Estado en vivo → error inmediato (duplicado/formato) o indicador (verificando / disponible). */
export function liveFeedback(state: AvailabilityState | undefined): { error?: string; status?: FieldStatus } {
  if (!state) return {};
  switch (state.status) {
    case 'checking':
      return { status: { tone: 'checking', text: 'Verificando disponibilidad…' } };
    case 'available':
      return { status: { tone: 'success', text: state.message } };
    case 'linkable':
      return { status: { tone: 'info', text: state.message } };
    case 'taken':
    case 'invalid':
      return { error: state.message };
    default:
      return {};
  }
}
