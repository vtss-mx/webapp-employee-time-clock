import { MessageSquarePlus, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../../components/ReasonFormPanel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyFraudCasesChanged } from '../../../hooks/usePendingFraudCases';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { fraudCaseService } from '../../../services/fraudCaseService';
import type { FraudCaseDetail } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { subjectOf } from './FraudCasesPage';

const MIN_NOTE = 3;
type Decision = 'CONFIRMED' | 'FALSE_POSITIVE' | 'INCONCLUSIVE';

/** Cada decisión: su ícono, su color y si la nota es obligatoria (confirmar o descartar, decisión del backend). */
const DECISIONS: Record<Decision, { Icon: typeof ShieldAlert; variant: 'danger' | 'success' | 'secondary'; tone: 'danger' | 'success' | 'primary'; required: boolean }> = {
  CONFIRMED: { Icon: ShieldAlert, variant: 'danger', tone: 'danger', required: true },
  FALSE_POSITIVE: { Icon: ShieldCheck, variant: 'success', tone: 'success', required: true },
  INCONCLUSIVE: { Icon: ShieldQuestion, variant: 'secondary', tone: 'primary', required: false },
};

const isDecision = (status: string | undefined): status is Decision => status !== undefined && Object.hasOwn(DECISIONS, status);
const requiredNote = (note: string) => (note.trim().length < MIN_NOTE ? t('fraud.decision.noteRequired') : undefined);
const loadError = () => t('fraud.detail.loadError');
const decideError = () => t('fraud.decision.error');
const noteError = () => t('fraud.note.error');

/** Antes de decidir: el caso, "antes → después" del estado, la nota y lo que pasará (bloqueo, etiquetas, aprendizaje). */
function decisionConfirm(item: FraudCaseDetail, status: Decision, note: string, statusName: (code: string) => string): ConfirmInput {
  const { Icon, tone } = DECISIONS[status];
  return {
    kind: 'edit',
    tone,
    icon: <Icon size={30} />,
    eyebrow: t('fraud.detail.eyebrow'),
    title: t(`fraud.decision.confirm.${status}`, { id: item.id }),
    message: t(`fraud.decision.effects.${status}`),
    changes: [{ label: t('fraud.list.status'), before: statusName(item.status), after: statusName(status) }],
    details: [
      { label: t('fraud.list.subject'), value: subjectOf(item) },
      { label: t('fraud.decision.noteLabel'), value: note || t('fraud.decision.noNote') },
    ],
    confirmLabel: t(`fraud.decision.actions.${status}`),
    confirmIcon: <Icon size={18} />,
  };
}

/** El caso para un formulario (con su esqueleto y "Reintentar"). */
function useCase(caseId: number) {
  return useResource((signal) => fraudCaseService.get(caseId, signal), caseId, loadError);
}

/**
 * Decidir un caso de fraude (`/admin/fraud-cases/:id/decision/:status`): confirmar el fraude (bloquea sus huellas,
 * etiqueta sus intentos y olvida lo aprendido desde entonces), descartarlo como falso positivo (libera sus huellas y
 * suma a la línea base) o dejarlo no concluyente. Confirmar y descartar exigen la nota; queda en el historial.
 */
export function FraudCaseDecisionPage() {
  const t = useT();
  const params = useParams();
  const caseId = Number(params.id);
  const status = isDecision(params.status) ? params.status : 'INCONCLUSIVE';
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { nameOf } = useCatalogs();
  const { data: item, error, retry } = useCase(caseId);

  if (!item) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  const { Icon, variant, required } = DECISIONS[status];
  const statusName = (code: string) => nameOf('fraud_case_statuses', code);
  return (
    <ReasonFormPanel
      title={t(`fraud.decision.actions.${status}`)}
      subtitle={t('fraud.detail.title', { id: item.id })}
      backTo={paths.admin.fraudCase(item.id)}
      backLabel={t('fraud.detail.title', { id: item.id })}
      icon={<Icon size={20} />}
      intro={t(`fraud.decision.effects.${status}`)}
      field={{ label: t('fraud.decision.noteLabel'), placeholder: t('fraud.decision.notePlaceholder'), required }}
      validate={required ? requiredNote : undefined}
      submit={{ label: t(`fraud.decision.actions.${status}`), icon: <Icon size={18} />, variant, disabled: item.status === status, disabledTitle: t('fraud.decision.already') }}
      confirm={(note) => () => decisionConfirm(item, status, note, statusName)}
      errorTitle={decideError}
      onSend={async (note) => {
        await fraudCaseService.decide(item.id, { status, note });
        notifyFraudCasesChanged();
        void feedback.success(() => t('fraud.decision.done'), () => t('fraud.decision.doneText', { status: statusName(status) }));
        void navigate(paths.admin.fraudCase(item.id));
      }}
      onCancel={() => void navigate(paths.admin.fraudCase(item.id))}
    />
  );
}

/** Agregar una nota al historial del caso (no cambia su estado). */
export function FraudCaseNotePage() {
  const t = useT();
  const caseId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: item, error, retry } = useCase(caseId);

  if (!item) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return (
    <ReasonFormPanel
      title={t('fraud.note.title')}
      subtitle={t('fraud.detail.title', { id: item.id })}
      backTo={paths.admin.fraudCase(item.id)}
      backLabel={t('fraud.detail.title', { id: item.id })}
      icon={<MessageSquarePlus size={20} />}
      intro={t('fraud.note.intro')}
      field={{ label: t('fraud.note.label'), placeholder: t('fraud.note.placeholder'), required: true }}
      validate={requiredNote}
      submit={{ label: t('fraud.note.submit'), icon: <MessageSquarePlus size={18} />, variant: 'primary' }}
      confirm={(note) => () => ({
        kind: 'create',
        title: t('fraud.note.confirmTitle', { id: item.id }),
        details: [{ label: t('fraud.note.label'), value: note }],
        confirmLabel: t('fraud.note.submit'),
      })}
      errorTitle={noteError}
      onSend={async (note) => {
        await fraudCaseService.addNote(item.id, note);
        void navigate(paths.admin.fraudCase(item.id));
      }}
      onCancel={() => void navigate(paths.admin.fraudCase(item.id))}
    />
  );
}
