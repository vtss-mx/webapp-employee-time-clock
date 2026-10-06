import { Inbox } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { absenceFacts, calendarPath, daysText, rangeText } from '../../../components/calendar/calendarRules';
import { RejectRequestPanel, type RejectQuestion } from '../../../components/RejectRequestPanel';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyAbsenceRequestsChanged } from '../../../hooks/usePendingAbsenceRequests';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { ApiError } from '../../../services/apiClient';
import { calendarService, isAbsence } from '../../../services/calendarService';
import type { Absence } from '../../../types';
import { isRecord } from '../../../utils/guards';

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

/** La confirmación del rechazo: qué se rechaza y qué pasa (se arma al dibujarse: sigue al idioma activo). */
function rejectQuestion(absence: Absence, typeName: string): RejectQuestion {
  return {
    title: t('calendar.reject.confirmTitle', { kind: typeName.toLowerCase(), name: absence.employee.full_name }),
    eyebrow: t('calendar.reject.title'),
    message: t('calendar.reject.confirmMessage'),
    facts: absenceFacts(absence, typeName),
  };
}

const loadError = () => t('calendar.reject.loadError');
const rejectedTitle = () => t('calendar.reject.done');
const rejectedText = (name: string) => () => t('calendar.reject.doneText', { name });

/** Ya no está pendiente: se explica y se ofrece volver a las solicitudes. */
function NotPending() {
  const t = useT();
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('calendar.reject.title')} backTo={calendarPath('requests')} backLabel={t('calendar.page.tabs.requests')} />
        <PanelSection>
          <EmptyState
            icon={<Inbox />}
            title={t('calendar.reject.notPending.title')}
            description={t('calendar.reject.notPending.description')}
            action={
              <ButtonLink to={calendarPath('requests')} variant="primary" icon={<Inbox size={18} />}>
                {t('calendar.reject.notPending.action')}
              </ButtonLink>
            }
          />
        </PanelSection>
      </Panel>
    </div>
  );
}

function RejectForm({ absence }: { absence: Absence }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { nameOf } = useCatalogs();
  const back = () => void navigate(calendarPath('requests'));
  const kind = nameOf('day_off_types', absence.type);
  return (
    <RejectRequestPanel
      title={t('calendar.reject.title')}
      subtitle={`${absence.employee.full_name} · ${absence.employee.employee_number}`}
      backTo={calendarPath('requests')}
      intro={t('calendar.reject.intro', { kind: kind.toLowerCase(), range: rangeText(absence.starts_on, absence.ends_on), days: daysText(absence.days) })}
      placeholder={t('calendar.reject.placeholder')}
      question={() => rejectQuestion(absence, kind)}
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
        void feedback.info(rejectedTitle, rejectedText(absence.employee.full_name));
        back();
      }}
      onCancel={back}
    />
  );
}

/** Rechazar una solicitud de vacaciones o permiso (/company/calendar/absences/:id/reject), con una nota para el empleado. */
export function AbsenceRejectPage() {
  const t = useT();
  const id = Number(useParams().id);
  const state: unknown = useLocation().state;
  const passed = isRecord(state) && isAbsence(state.absence) ? state.absence : null;
  const { data, error, retry } = useResource(async (signal) => ({ absence: await pendingAbsence(id, passed, signal) }), id, loadError);

  if (!data) return error ? <LoadFailed title={t('calendar.reject.title')} backTo={calendarPath('requests')} backLabel={t('calendar.page.tabs.requests')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  return data.absence ? <RejectForm absence={data.absence} /> : <NotPending />;
}
