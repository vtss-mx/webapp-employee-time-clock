import { Info, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { AttendanceList, cancelRequestConfirm } from '../../../components/attendance/employee/AttendanceItem';
import { ShiftRequestItem } from '../../../components/attendance/employee/ShiftRequestItem';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useAction } from '../../../hooks/useAction';
import { usePagedList } from '../../../hooks/usePagedList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { ShiftRequest } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

// Títulos de los popups (se arman al dibujarse: siguen al idioma activo).
const loadError = () => t('myAttendance.shiftRequests.loadError');
const cancelError = () => t('myAttendance.cancelRequest.error');

/** Cancelar la solicitud pendiente: el turno que pidió (horario y días) y desde cuándo. */
function requestCancelConfirm(request: ShiftRequest): ConfirmInput {
  return cancelRequestConfirm({
    title: t('myAttendance.shiftRequests.cancel.title'),
    message: t('myAttendance.shiftRequests.cancel.message'),
    details: [
      { label: t('myAttendance.shiftRequests.cancel.shift'), value: `${request.shift.name} · ${shiftSchedule(request.shift)} · ${weekdaysLabel(request.shift.weekdays)}` },
      { label: t('myAttendance.labels.from'), value: formatDate(request.valid_from) },
    ],
  });
}

/** "Pedir cambio de turno": deshabilitado mientras haya una pendiente (el servidor también lo impide). */
function NewRequestButton({ blocked }: { blocked: boolean }) {
  const t = useT();
  if (blocked) {
    return (
      <Button variant="primary" size="lg" icon={<Plus size={20} />} disabled>
        {t('myAttendance.shiftRequests.new')}
      </Button>
    );
  }
  return (
    <ButtonLink to={paths.employee.newShiftRequest} variant="primary" size="lg" icon={<Plus size={20} />}>
      {t('myAttendance.shiftRequests.new')}
    </ButtonLink>
  );
}

/**
 * Mis solicitudes de cambio de turno (/employee/attendance/requests), paginadas en el servidor (la más
 * reciente primero). Solo puede haber una pendiente a la vez: mientras exista, no se pide otra y se
 * puede cancelar (con confirmación).
 */
export function MyShiftRequestsPage() {
  const t = useT();
  // La pendiente siempre es la más reciente (una a la vez): basta con la primera página para saberlo.
  const [pending, setPending] = useState(false);
  const list = usePagedList(
    async (page, signal) => {
      const result = await attendanceService.myRequests(page, signal);
      if (page.page === 1) setPending(result.items.some((request) => request.status === 'PENDING'));
      return result;
    },
    { errorTitle: loadError },
  );
  const { busy, run } = useAction<number>();

  const cancel = (request: ShiftRequest) =>
    void run(() => attendanceService.cancelRequest(request.id), {
      busy: request.id,
      confirm: () => requestCancelConfirm(request),
      errorTitle: cancelError,
      onSuccess: list.retry,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('myAttendance.home.shiftChange')}
          subtitle={t('myAttendance.shiftRequests.subtitle')}
          backTo={paths.employee.attendance}
          backLabel={t('myAttendance.home.eyebrow')}
          actions={<NewRequestButton blocked={pending} />}
        />
        <PanelSection>
          {pending && (
            <p className="inline-note small muted">
              <Info size={16} aria-hidden /> {t('myAttendance.shiftRequests.pendingNote')}
            </p>
          )}
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <Repeat />,
              title: t('myAttendance.shiftRequests.empty.title'),
              description: t('myAttendance.shiftRequests.empty.description'),
            }}
            pager={{ noun: { one: t('myAttendance.shiftRequests.noun.one'), other: t('myAttendance.shiftRequests.noun.other') } }}
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
