import { useState, type SubmitEvent, type ReactNode } from 'react';
import { useSubmit, type ErrorTitle } from '../hooks/useAction';
import { useT } from '../i18n';
import { resolveLazy } from '../i18n/lazy';
import type { ConfirmSource } from '../types/confirm';
import type { ButtonVariant } from './ui/Button';
import { FormFooter } from './FormFooter';
import { ReasonField } from './ReasonField';
import { Panel, PanelHeader, PanelSection } from './ui/Panel';

interface ReasonFormPanelProps {
  title: string;
  subtitle: string;
  backTo: string;
  backLabel: string;
  /** Qué pasará al confirmar (se explica antes del motivo). */
  intro: ReactNode;
  icon: ReactNode;
  /** Sin `catalog`, el campo no ofrece sugerencias (p. ej. la nota al rechazar un cambio de turno). */
  field: { catalog?: 'enrollment_rejection_reasons' | 'reverification_reasons'; label: string; placeholder: string; required?: boolean };
  /** Regla del motivo (solo UX: el backend la vuelve a validar); su error se ve al intentar enviar. */
  validate?: (reason: string) => string | undefined;
  submit: { label: string; icon: ReactNode; variant: ButtonVariant; disabled?: boolean; disabledTitle?: string };
  /**
   * Confirmación ANTES de enviar (con el motivo escrito): cancelar no envía nada y el formulario sigue
   * disponible. Se vuelve a pedir en cada dibujo del popup: con `t('…')` adentro, la confirmación
   * abierta sigue al idioma activo.
   */
  confirm: (reason: string) => ConfirmSource;
  /** Envía el motivo (sin espacios sobrantes); al salir bien, la pantalla navega a otra. */
  onSend: (reason: string) => Promise<void>;
  /** Título del popup si no se pudo enviar (el motivo lo explica el error); con una función sigue al idioma activo. */
  errorTitle: ErrorTitle;
  onCancel: () => void;
}

/**
 * Pantalla de formulario con un motivo que verá la persona (rechazar un registro, pedir nueva
 * verificación). Lleva el motivo, su regla y el envío ("Guardando…" hasta salir; si falla, el
 * popup lo explica y se puede corregir): cada pantalla solo dice qué se envía y a dónde regresa.
 */
export function ReasonFormPanel({ title, subtitle, backTo, backLabel, intro, icon, field, validate, submit, confirm, onSend, errorTitle, onCancel }: ReasonFormPanelProps) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const { saving, submit: send } = useSubmit();

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    setTouched(true);
    if (validate?.(reason)) return;
    const text = reason.trim();
    // La confirmación se arma al dibujarse (no ahora): el popup abierto sigue al idioma activo.
    void send(() => onSend(text), errorTitle, { confirm: () => resolveLazy(confirm(text)) });
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={title} subtitle={subtitle} backTo={backTo} backLabel={backLabel} />
        <PanelSection title={t('common.fields.reason')} icon={icon}>
          <p className="muted">{intro}</p>
          <ReasonField
            catalog={field.catalog}
            label={field.label}
            required={field.required}
            value={reason}
            onChange={setReason}
            disabled={saving}
            error={touched ? validate?.(reason) : undefined}
            placeholder={field.placeholder}
          />
        </PanelSection>
        <FormFooter
          submitLabel={submit.label}
          submitIcon={submit.icon}
          submitVariant={submit.variant}
          saving={saving}
          disabled={submit.disabled}
          disabledTitle={submit.disabledTitle}
          onCancel={onCancel}
        />
      </Panel>
    </div>
  );
}
