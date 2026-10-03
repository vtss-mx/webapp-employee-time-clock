import type { ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Interruptor accesible (role="switch") con etiqueta, descripción e icono. Toda la fila es una
 * `<label>` del botón: en teléfonos y tabletas se activa tocando cualquier parte (como en los
 * ajustes del sistema), no solo el control de 54×32.
 */
export function Switch({ checked, onChange, label, description, icon, badge, disabled = false, busy = false }: SwitchProps) {
  return (
    <label className={`switch-row ${checked ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}>
      {icon && <span className="switch-row__icon">{icon}</span>}
      <span className="switch-row__text">
        <span className="switch-row__label">
          {label} {badge}
        </span>
        {description && <span className="switch-row__description">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={busy}
        aria-label={typeof label === 'string' ? label : undefined}
        className={`switch ${busy ? 'is-busy' : ''}`}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </label>
  );
}
