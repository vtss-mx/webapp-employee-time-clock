import { useNavigate } from 'react-router-dom';
import { RejectRequestPanel } from '../../../components/RejectRequestPanel';
import { leaveIfClosed, PendingRequest } from '../../../components/shifts/PendingRequest';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyShiftRequestsChanged } from '../../../hooks/usePendingShiftRequests';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import { formatDate } from '../../../utils/format';

/** Rechazar un cambio de turno (/company/shifts/requests/:id/reject): conserva su turno y ve la nota. */
export function ShiftRequestRejectPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const back = () => void navigate(paths.company.shiftRequests);
  return (
    <PendingRequest title="Rechazar cambio de turno">
      {(request) => (
        <RejectRequestPanel
          title="Rechazar cambio de turno"
          subtitle={`${request.employee.full_name} · ${request.employee.employee_number}`}
          backTo={paths.company.shiftRequests}
          intro={`Pidió cambiar al turno ${request.shift.name} desde el ${formatDate(request.valid_from)}. Conservará su turno actual y verá esta nota en su solicitud.`}
          placeholder="Explica por qué no se puede hacer el cambio (p. ej. falta personal en ese horario)"
          question={{
            title: `¿Rechazar el cambio de ${request.employee.full_name}?`,
            eyebrow: 'Rechazar cambio de turno',
            message: 'Conservará su turno actual y verá tu nota en su solicitud.',
            facts: [{ label: 'Turno pedido', value: `${request.shift.name} desde el ${formatDate(request.valid_from)}` }],
          }}
          onSend={async (note) => {
            await shiftService.reject(request.id, note).catch((err: unknown) => {
              leaveIfClosed(err, back);
              throw err; // el popup explica el motivo
            });
            notifyShiftRequestsChanged();
            void feedback.info('Solicitud rechazada', `${request.employee.full_name} conserva su turno y verá tu nota.`);
            back();
          }}
          onCancel={back}
        />
      )}
    </PendingRequest>
  );
}
