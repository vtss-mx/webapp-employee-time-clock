import { CalendarX2 } from 'lucide-react';
import { t as translate, useT } from '../i18n';
import { resolveLazy, type Lazy } from '../i18n/lazy';
import type { ConfirmDetail } from '../types/confirm';
import { ReasonFormPanel } from './ReasonFormPanel';

/** Mínimo de la nota (el mismo que el backend; el máximo, 500, lo limita el campo). */
const NOTE_MIN = 5;

/** El empleado verá la nota: es obligatoria (el mensaje, en el idioma activo). */
export const validateRejectNote = (note: string) => (note.trim().length < NOTE_MIN ? translate('dialogs.reject.noteTooShort', { min: NOTE_MIN }) : undefined);

/** La pregunta de la confirmación: su título, su etiqueta, la consecuencia y lo que se rechaza (la nota se suma sola). */
export interface RejectQuestion {
  title: string;
  eyebrow: string;
  message: string;
  facts: ConfirmDetail[];
}

interface RejectRequestPanelProps {
  title: string;
  /** Quién la pidió ("Ana Ruiz · EMP-7"). */
  subtitle: string;
  backTo: string;
  /** Qué pidió y qué pasará al rechazarla. */
  intro: string;
  placeholder: string;
  /**
   * La confirmación: la pregunta, su etiqueta, la consecuencia y lo que se rechaza (la nota se suma
   * sola). Con una función (`() => ({ title: t('…'), … })`) el popup abierto sigue al idioma activo.
   */
  question: Lazy<RejectQuestion>;
  /** Envía el rechazo con la nota (sin espacios sobrantes); al salir bien, la pantalla regresa. */
  onSend: (note: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Rechazar una solicitud del empleado (cambio de turno, vacaciones o permiso) con una nota obligatoria
 * que él verá: el formulario con motivo, su regla y la confirmación previa al envío, iguales para
 * todas las solicitudes; cada pantalla solo dice qué se rechaza y a dónde regresa.
 */
export function RejectRequestPanel({ title, subtitle, backTo, intro, placeholder, question, onSend, onCancel }: RejectRequestPanelProps) {
  const t = useT();
  return (
    <ReasonFormPanel
      title={title}
      subtitle={subtitle}
      backTo={backTo}
      backLabel={t('dialogs.reject.back')}
      icon={<CalendarX2 size={20} />}
      intro={intro}
      field={{ label: t('dialogs.reject.noteLabel'), placeholder, required: true }}
      validate={validateRejectNote}
      submit={{ label: t('common.actions.reject'), icon: <CalendarX2 size={18} />, variant: 'danger' }}
      confirm={(note) => {
        // Se arma en cada dibujo del popup (con `translate`, el traductor vigente): textos en el idioma activo.
        const { eyebrow, title, message, facts } = resolveLazy(question);
        return {
          tone: 'danger',
          icon: <CalendarX2 size={30} />,
          eyebrow,
          title,
          message,
          details: [...facts, { label: translate('dialogs.reject.noteShown'), value: note }],
          confirmLabel: translate('common.actions.reject'),
          confirmIcon: <CalendarX2 size={18} />,
        };
      }}
      errorTitle={() => translate('dialogs.reject.errorTitle')}
      onSend={onSend}
      onCancel={onCancel}
    />
  );
}
