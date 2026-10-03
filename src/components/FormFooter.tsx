import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './ui/Button';
import { PanelFooter } from './ui/Panel';

interface FormFooterProps {
  /** Texto e ícono del botón que guarda (envía el formulario). */
  submitLabel: string;
  submitIcon: ReactNode;
  submitVariant?: ButtonVariant;
  saving: boolean;
  /** Deshabilita el envío (con el motivo en el globo de ayuda). */
  disabled?: boolean;
  disabledTitle?: string;
  onCancel: () => void;
}

/** Pie de toda pantalla de formulario: Cancelar y el botón que envía (con su estado de guardado). */
export function FormFooter({ submitLabel, submitIcon, submitVariant = 'primary', saving, disabled = false, disabledTitle, onCancel }: FormFooterProps) {
  return (
    <PanelFooter>
      <Button variant="ghost" size="lg" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" variant={submitVariant} size="lg" icon={submitIcon} loading={saving} disabled={disabled} title={disabled ? disabledTitle : undefined}>
        {submitLabel}
      </Button>
    </PanelFooter>
  );
}
