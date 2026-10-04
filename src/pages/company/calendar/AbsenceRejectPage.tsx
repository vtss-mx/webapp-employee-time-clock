import { Inbox } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { absenceFacts, calendarPath, daysText, rangeText } from '../../../components/calendar/calendarRules';
import { RejectRequestPanel } from '../../../components/RejectRequestPanel';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyAbsenceRequestsChanged } from '../../../hooks/usePendingAbsenceRequests';
import { useResource } from '../../../hooks/useResource';
import { ApiError } from '../../../services/apiClient';
import { calendarService, isAbsence } from '../../../services/calendarService';
import type { Absence } from '../../../types';
import { isRecord } from '../../../utils/guards';

const TITLE = 'Rechazar solicitud';
/** Pendientes por página al buscarla (la página más grande de la API) y tope de páginas: nunca sin límite. */
const SEARCH_SIZE = 50;
const SEARCH_PAGES = 20;

/**
 * La solicitud PENDIENTE con ese id: la que trae la navegación desde la pestaña "Solicitudes" o, en
 * una recarga o un enlace directo, la que aparezca en las páginas de pendientes (con tope). null: ya
 * se decidió, se canceló o no existe.
 */
export async function pendingAbsence(id: number, passed: Absence | null, signal: AbortSignal): Promise<Absence | null> {
  if (passed?.id === id) return passed;
  let page = 0;
  let seen = 0;
  let total = 1;
  while (seen < total && page < SEARCH_PAGES) {
    page += 1;
    const result = await calendarService.absences({ status: 'PENDING', page, size: SEARCH_SIZE }, signal);
    const match = result.items.find((absence) => absence.id === id);
    if (match) return match;
    seen = page * SEARCH_SIZE;
    total = result.total;
  }
  return null;
}

/** Ya no está pendiente: se explica y se ofrece volver a las solicitudes. */
function NotPending() {
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={TITLE} backTo={calendarPath('requests')} backLabel="Solicitudes" />
        <PanelSection>
          <EmptyState
            icon={<Inbox />}
            title="Esta solicitud ya no está pendiente"
            description="Ya se aprobó, se rechazó o el empleado la canceló. Su estado aparece en la pestaña «Ausencias» del calendario."
            action={
              <ButtonLink to={calendarPath('requests')} variant="primary" icon={<Inbox size={18} />}>
                Ver solicitudes
              </ButtonLink>
            }
          />
        </PanelSection>
      </Panel>
    </div>
  );
}

function RejectForm({ absence }: { absence: Absence }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { nameOf } = useCatalogs();
  const back = () => void navigate(calendarPath('requests'));
  const kind = nameOf('day_off_types', absence.type);
  return (
    <RejectRequestPanel
      title={TITLE}
      subtitle={`${absence.employee.full_name} · ${absence.employee.employee_number}`}
      backTo={calendarPath('requests')}
      intro={`Pidió ${kind.toLowerCase()}: ${rangeText(absence.starts_on, absence.ends_on)} (${daysText(absence.days)}). Esos días seguirá teniendo que checar y verá esta nota en su solicitud.`}
      placeholder="Explica por qué no se puede (p. ej. es temporada alta y falta personal)"
      question={{
        title: `¿Rechazar ${kind.toLowerCase()} de ${absence.employee.full_name}?`,
        eyebrow: 'Rechazar solicitud',
        message: 'Esos días seguirá teniendo que checar y verá tu nota en su solicitud.',
        facts: absenceFacts(absence, kind),
      }}
      onSend={async (note) => {
        await calendarService.rejectAbsence(absence.id, note).catch((error: unknown) => {
          // Otra persona ya la decidió o el empleado la canceló: el popup lo explica y se vuelve a la bandeja.
          if (error instanceof ApiError && error.code === 'ABSENCE_CLOSED') {
            notifyAbsenceRequestsChanged();
            back();
          }
          throw error;
        });
        notifyAbsenceRequestsChanged();
        void feedback.info('Solicitud rechazada', `${absence.employee.full_name} conserva esos días como laborables y verá tu nota.`);
        back();
      }}
      onCancel={back}
    />
  );
}

/** Rechazar una solicitud de vacaciones o permiso (/company/calendar/absences/:id/reject), con una nota para el empleado. */
export function AbsenceRejectPage() {
  const id = Number(useParams().id);
  const state: unknown = useLocation().state;
  const passed = isRecord(state) && isAbsence(state.absence) ? state.absence : null;
  const { data, error, retry } = useResource(async (signal) => ({ absence: await pendingAbsence(id, passed, signal) }), id, 'No se pudo cargar la solicitud');

  if (!data) return error ? <LoadFailed title={TITLE} backTo={calendarPath('requests')} backLabel="Solicitudes" onRetry={retry} /> : <SkeletonCard lines={6} />;
  return data.absence ? <RejectForm absence={data.absence} /> : <NotPending />;
}
