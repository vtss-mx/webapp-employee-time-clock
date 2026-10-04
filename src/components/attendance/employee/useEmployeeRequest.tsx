import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../../../hooks/useFeedback';
import type { ConfirmDetail, ConfirmInput } from '../../../types/confirm';

/** Lo que usa del formulario (`useFormState`): enviar si es válido, tras confirmar. */
interface RequestForm {
  saveIfValid: (errors: Record<string, string | undefined>, action: () => Promise<void>, title: string, confirm: () => ConfirmInput) => void;
}

/** Qué se pide: la pregunta, lo que se enviará y el aviso al salir bien. */
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
 * Si algo falta, se marcan los campos y nada se envía.
 */
export function useEmployeeRequest(form: RequestForm, list: string) {
  const feedback = useFeedback();
  const navigate = useNavigate();
  return (errors: Record<string, string | undefined>, send: () => Promise<unknown>, request: () => EmployeeRequest) =>
    form.saveIfValid(
      errors,
      async () => {
        await send();
        void feedback.success('Solicitud enviada a tu empresa', request().done);
        void navigate(list, { replace: true });
      },
      'No se pudo enviar tu solicitud',
      () => {
        const { title, details } = request();
        return {
          kind: 'create',
          icon: <Send size={30} />,
          eyebrow: 'Solicitud a tu empresa',
          title,
          message: 'Tu empresa la revisará y aquí verás si la aprueba; mientras esté pendiente la puedes cancelar.',
          detailsTitle: 'Se enviará',
          details,
          confirmLabel: 'Enviar solicitud',
          confirmIcon: <Send size={18} />,
        };
      },
    );
}
