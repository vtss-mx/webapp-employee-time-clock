import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../../../hooks/useFeedback';
import { t, type Lazy } from '../../../i18n';
import type { ConfirmDetail, ConfirmInput } from '../../../types/confirm';

/** Errores de lo capturado (o la función que los calcula: el resumen abierto sigue al idioma activo). */
type RequestErrors = Lazy<Record<string, string | undefined>>;

/** Lo que usa del formulario (`useFormState`): enviar si es válido, tras confirmar. */
interface RequestForm {
  saveIfValid: (errors: RequestErrors, action: () => Promise<void>, title: () => string, confirm: () => ConfirmInput) => void;
}

/** Qué se pide: la pregunta, lo que se enviará y el aviso al salir bien (en el idioma activo). */
interface EmployeeRequest {
  /** "¿Pedir vacaciones?". */
  title: string;
  details: ConfirmDetail[];
  /** Qué sigue (en el aviso de éxito). */
  done: string;
}

/**
 * Enviar una solicitud del empleado a su empresa (cambio de turno, vacaciones o permiso): si lo
 * capturado es válido, confirma lo que se enviará; al salir bien avisa y vuelve a su lista (`list`).
 * Si algo falta, se marcan los campos y nada se envía. `request` se llama al dibujar la confirmación
 * y el aviso: abiertos, siguen al idioma activo.
 */
export function useEmployeeRequest(form: RequestForm, list: string) {
  const feedback = useFeedback();
  const navigate = useNavigate();
  return (errors: RequestErrors, send: () => Promise<unknown>, request: () => EmployeeRequest) =>
    form.saveIfValid(
      errors,
      async () => {
        await send();
        void feedback.success(
          () => t('myAttendance.request.sent'),
          () => request().done,
        );
        void navigate(list, { replace: true });
      },
      () => t('myAttendance.request.error'),
      () => {
        const { title, details } = request();
        return {
          kind: 'create',
          icon: <Send size={30} />,
          eyebrow: t('myAttendance.request.eyebrow'),
          title,
          message: t('myAttendance.request.message'),
          detailsTitle: t('myAttendance.request.detailsTitle'),
          details,
          confirmLabel: t('myAttendance.request.send'),
          confirmIcon: <Send size={18} />,
        };
      },
    );
}
