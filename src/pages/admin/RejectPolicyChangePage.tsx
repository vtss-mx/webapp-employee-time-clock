import { History, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { describeFieldChange } from '../../components/policy/policyFields';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { AdminVerificationPolicy, PolicyChange } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { config } from '../../utils/config';

const MIN_NOTE = 3;
const validateNote = (note: string) => (note.trim().length < MIN_NOTE ? t('policy.changes.rejectPage.required') : undefined);
const loadError = () => t('policy.changes.rejectPage.loadError');
const rejectError = () => t('policy.changes.rejectPage.error');

/** Antes de rechazar: de quién es el cambio, cada campo "antes → después" y el motivo que leerá. */
function rejectConfirm(change: PolicyChange, policy: AdminVerificationPolicy, catalogs: Pick<CatalogApi, 'accessories' | 'nameOf'>, note: string): ConfirmInput {
  return {
    tone: 'danger',
    icon: <XCircle size={30} />,
    eyebrow: t('policy.changes.eyebrow'),
    title: t('policy.changes.rejectPage.confirmTitle', { who: change.requested_by }),
    message: t('policy.changes.rejectPage.confirmMessage'),
    changes: change.changes.map((field) => describeFieldChange(field, policy, catalogs)),
    details: [{ label: t('policy.changes.rejectPage.label'), value: note }],
    confirmLabel: t('policy.changes.reject'),
    confirmIcon: <XCircle size={18} />,
  };
}

/**
 * Rechazar un cambio de la política que espera aprobación (regla de dos personas; solo un ADMIN distinto de quien
 * lo pidió). El motivo es obligatorio: lo lee quien lo pidió. Si el cambio ya no espera aprobación (otro lo decidió,
 * venció o se retiró), lo dice y regresa a la política.
 */
export function RejectPolicyChangePage() {
  const t = useT();
  const params = useParams();
  const companyId = Number(params.id);
  const changeId = Number(params.changeId);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const catalogs = useCatalogs();
  const back = paths.admin.companyPolicy(companyId);
  const { data, error, retry } = useResource(
    (signal) =>
      Promise.all([
        adminService.policy(companyId, signal),
        adminService.policyChanges(companyId, { page: 1, size: Math.max(...config.pageSizes), status: 'PENDING' }, signal),
      ]),
    `${companyId}|${changeId}`,
    loadError,
  );

  if (!data) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  const [policy, pending] = data;
  const change = pending.items.find((item) => item.id === changeId);
  if (!change) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('policy.changes.rejectPage.title')} backTo={back} backLabel={t('policy.changes.rejectPage.back')} />
          <PanelSection>
            <EmptyState compact icon={<History />} title={t('policy.changes.rejectPage.missing')} description={t('policy.changes.rejectPage.missingDescription')} />
          </PanelSection>
        </Panel>
      </div>
    );
  }
  return (
    <ReasonFormPanel
      title={t('policy.changes.rejectPage.title')}
      subtitle={change.requested_by}
      backTo={back}
      backLabel={t('policy.changes.rejectPage.back')}
      icon={<XCircle size={20} />}
      intro={t('policy.changes.rejectPage.intro')}
      field={{ label: t('policy.changes.rejectPage.label'), placeholder: t('policy.changes.rejectPage.placeholder'), required: true }}
      validate={validateNote}
      submit={{ label: t('policy.changes.reject'), icon: <XCircle size={18} />, variant: 'danger' }}
      confirm={(note) => () => rejectConfirm(change, policy, catalogs, note)}
      errorTitle={rejectError}
      onSend={async (note) => {
        await adminService.rejectPolicyChange(companyId, change.id, note);
        void feedback.success(() => t('policy.changes.rejectPage.done'));
        void navigate(back);
      }}
      onCancel={() => void navigate(back)}
    />
  );
}
