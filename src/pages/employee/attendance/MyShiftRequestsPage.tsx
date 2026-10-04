import { CalendarX, Info, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { AttendanceList } from '../../../components/attendance/employee/AttendanceItem';
import { ShiftRequestItem } from '../../../components/attendance/employee/ShiftRequestItem';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useAction } from '../../../hooks/useAction';
import { usePagedList } from '../../../hooks/usePagedList';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { ShiftRequest } from '../../../types';
import { formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/** "Pedir cambio de turno": deshabilitado mientras haya una pendiente (el servidor también lo impide). */
function NewRequestButton({ blocked }: { blocked: boolean }) {
  if (blocked) {
    return (
      <Button variant="primary" size="lg" icon={<Plus size={20} />} disabled>
        Pedir cambio de turno
      </Button>
    );
  }
  return (
    <ButtonLink to={paths.employee.newShiftRequest} variant="primary" size="lg" icon={<Plus size={20} />}>
      Pedir cambio de turno
    </ButtonLink>
  );
}

/**
 * Mis solicitudes de cambio de turno (/employee/attendance/requests), paginadas en el servidor (la más
 * reciente primero). Solo puede haber una pendiente a la vez: mientras exista, no se pide otra y se
 * puede cancelar (con confirmación).
 */
export function MyShiftRequestsPage() {
  // La pendiente siempre es la más reciente (una a la vez): basta con la primera página para saberlo.
  const [pending, setPending] = useState(false);
  const list = usePagedList(
    async (page, signal) => {
      const result = await attendanceService.myRequests(page, signal);
      if (page.page === 1) setPending(result.items.some((request) => request.status === 'PENDING'));
      return result;
    },
    { errorTitle: 'No se pudieron cargar tus solicitudes' },
  );
  const { busy, run } = useAction<number>();

  const cancel = (request: ShiftRequest) =>
    void run(() => attendanceService.cancelRequest(request.id), {
      busy: request.id,
      confirm: {
        kind: 'delete',
        icon: <CalendarX size={30} />,
        eyebrow: 'Tu solicitud',
        title: '¿Cancelar tu solicitud de cambio de turno?',
        message: 'Se retirará y tu empresa ya no la revisará. Después podrás pedir otra.',
        details: [
          { label: 'Turno que pediste', value: `${request.shift.name} · ${shiftSchedule(request.shift)} · ${weekdaysLabel(request.shift.weekdays)}` },
          { label: 'Desde', value: formatDate(request.valid_from) },
        ],
        confirmLabel: 'Cancelar solicitud',
        confirmIcon: <CalendarX size={18} />,
        cancelLabel: 'Conservarla',
      },
      errorTitle: 'No se pudo cancelar la solicitud',
      onSuccess: list.retry,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Cambio de turno"
          subtitle="Pide a tu empresa otro turno con al menos un día de anticipación y sigue aquí su respuesta."
          backTo={paths.employee.attendance}
          backLabel="Mi asistencia"
          actions={<NewRequestButton blocked={pending} />}
        />
        <PanelSection>
          {pending && (
            <p className="inline-note small muted">
              <Info size={16} aria-hidden /> Solo puedes tener una solicitud pendiente a la vez: espera la respuesta de tu empresa o cancélala para pedir otra.
            </p>
          )}
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <Repeat />,
              title: 'Aún no has pedido cambios de turno',
              description: 'Cuando pidas otro turno, aquí verás si tu empresa lo aprobó y desde cuándo aplica.',
            }}
            pager={{ noun: { one: 'solicitud', other: 'solicitudes' } }}
          >
            {(requests) => (
              <AttendanceList loading={list.loading}>
                {requests.map((request) => (
                  <ShiftRequestItem key={request.id} request={request} busy={busy === request.id} onCancel={() => cancel(request)} />
                ))}
              </AttendanceList>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
