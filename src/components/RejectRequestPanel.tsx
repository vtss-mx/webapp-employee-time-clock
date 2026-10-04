import { CalendarX2 } from 'lucide-react';
import type { ConfirmDetail } from '../types/confirm';
import { ReasonFormPanel } from './ReasonFormPanel';

/** Mínimo de la nota (el mismo que el backend; el máximo, 500, lo limita el campo). */
const NOTE_MIN = 5;

/** El empleado verá la nota: es obligatoria. */
export const validateRejectNote = (note: string) => (note.trim().length < NOTE_MIN ? `Escribe por qué no se aprueba (al menos ${NOTE_MIN} caracteres): el empleado lo verá` : undefined);

interface RejectRequestPanelProps {
  title: string;
  /** Quién la pidió ("Ana Ruiz · EMP-7"). */
  subtitle: string;
  backTo: string;
  /** Qué pidió y qué pasará al rechazarla. */
  intro: string;
  placeholder: string;
  /** La confirmación: la pregunta, su etiqueta, la consecuencia y lo que se rechaza (la nota se suma sola). */
  question: { title: string; eyebrow: string; message: string; facts: ConfirmDetail[] };
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
  return (
    <ReasonFormPanel
      title={title}
      subtitle={subtitle}
      backTo={backTo}
      backLabel="Solicitudes"
      icon={<CalendarX2 size={20} />}
      intro={intro}
      field={{ label: 'Nota para el empleado', placeholder, required: true }}
      validate={validateRejectNote}
      submit={{ label: 'Rechazar', icon: <CalendarX2 size={18} />, variant: 'danger' }}
      confirm={(note) => ({
        tone: 'danger',
        icon: <CalendarX2 size={30} />,
        eyebrow: question.eyebrow,
        title: question.title,
        message: question.message,
        details: [...question.facts, { label: 'Nota que verá', value: note }],
        confirmLabel: 'Rechazar',
        confirmIcon: <CalendarX2 size={18} />,
      })}
      errorTitle="No se pudo rechazar la solicitud"
      onSend={onSend}
      onCancel={onCancel}
    />
  );
}
