import { CalendarCheck, CheckCircle2, FileText, Repeat } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormFooter } from '../../../components/FormFooter';
import { leaveIfClosed, PendingRequest, RequestSummary } from '../../../components/shifts/PendingRequest';
import { PlacementFields } from '../../../components/shifts/PlacementFields';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { usePlacement } from '../../../components/shifts/usePlacement';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Switch } from '../../../components/ui/Switch';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyShiftRequestsChanged } from '../../../hooks/usePendingShiftRequests';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { ShiftRequest, ShiftRequestApproval } from '../../../types';
import { formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/** Aprobar un cambio de turno (/company/shifts/requests/:id/approve): programa el turno pedido. */
export function ShiftRequestApprovePage() {
  return <PendingRequest title="Aprobar cambio de turno">{(request) => <ApproveForm key={request.id} request={request} />}</PendingRequest>;
}

function ApproveForm({ request }: { request: ShiftRequest }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const tomorrow = businessTomorrow();
  const [keep, setKeep] = useState(true);
  // La fecha pedida, salvo que ya no tenga el día de anticipación (entonces, desde mañana).
  const placement = usePlacement(
    { validFrom: request.valid_from < tomorrow ? tomorrow : request.valid_from, remote: [], siteIds: [] },
    { shift: request.shift, minDate: tomorrow, minMessage: 'Elige desde mañana: el cambio de turno se programa con un día de anticipación.', withPlace: !keep },
  );
  const back = () => void navigate(paths.company.shiftRequests);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const validFrom = placement.values.validFrom;
    const approval: ShiftRequestApproval = keep ? { valid_from: validFrom } : { valid_from: validFrom, remote_weekdays: placement.remote, site_ids: placement.values.siteIds };
    placement.send(
      async () => {
        await shiftService.approve(request.id, approval);
        notifyShiftRequestsChanged();
        void feedback.success('Cambio de turno aprobado', `${request.employee.full_name} tendrá el turno ${request.shift.name} desde el ${formatDate(validFrom)}. Su turno actual termina el día anterior.`);
        back();
      },
      'No se pudo aprobar el cambio de turno',
      (shift, place) => ({
        tone: 'success',
        icon: <CheckCircle2 size={30} />,
        eyebrow: 'Aprobar cambio de turno',
        title: `¿Aprobar el cambio de ${request.employee.full_name} al turno ${shift.name}?`,
        message: 'Su turno actual termina el día anterior y lo ya registrado no cambia.',
        details: [{ label: 'Horario', value: `${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}` }, ...place],
        confirmLabel: 'Aprobar cambio',
        confirmIcon: <CheckCircle2 size={18} />,
      }),
      (err) => leaveIfClosed(err, back),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Aprobar cambio de turno" subtitle={`${request.employee.full_name} · ${request.employee.employee_number}`} backTo={paths.company.shiftRequests} backLabel="Solicitudes" />
        <PanelSection title="Solicitud" icon={<FileText size={20} />}>
          <RequestSummary request={request} />
        </PanelSection>
        <PanelSection title="Desde cuándo y dónde checa" icon={<CalendarCheck size={20} />}>
          <PlacementFields
            placement={placement}
            shift={request.shift}
            minDate={tomorrow}
            dateHint={`Pidió desde el ${formatDate(request.valid_from)}. Su turno actual termina el día anterior y lo ya registrado no cambia.`}
            withPlace={!keep}
          >
            <Switch
              checked={keep}
              onChange={setKeep}
              disabled={placement.saving}
              icon={<Repeat size={20} />}
              label="Conservar días remotos y sitios actuales"
              description={
                keep
                  ? 'Conserva los días remotos que el nuevo turno también trabaja y los sitios de su turno actual.'
                  : 'Elige de nuevo los días en que checa remoto y los sitios donde checa en persona.'
              }
            />
          </PlacementFields>
        </PanelSection>
        <FormFooter submitLabel="Aprobar cambio" submitIcon={<CheckCircle2 size={20} />} submitVariant="success" saving={placement.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
