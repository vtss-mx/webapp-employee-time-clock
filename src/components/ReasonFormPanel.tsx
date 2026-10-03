import type { FormEvent, ReactNode } from 'react';
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
  field: { catalog: 'enrollment_rejection_reasons' | 'reverification_reasons'; label: string; placeholder: string; required?: boolean; error?: string };
  reason: string;
  onReason: (value: string) => void;
  submit: { label: string; icon: ReactNode; variant: ButtonVariant; disabled?: boolean; disabledTitle?: string };
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}

/** Pantalla de formulario con un motivo que verá la persona (rechazar un registro, pedir nueva verificación). */
export function ReasonFormPanel({ title, subtitle, backTo, backLabel, intro, icon, field, reason, onReason, submit, saving, onSubmit, onCancel }: ReasonFormPanelProps) {
  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={title} subtitle={subtitle} backTo={backTo} backLabel={backLabel} />
        <PanelSection title="Motivo" icon={icon}>
          <p className="muted">{intro}</p>
          <ReasonField catalog={field.catalog} label={field.label} required={field.required} value={reason} onChange={onReason} disabled={saving} error={field.error} placeholder={field.placeholder} />
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
