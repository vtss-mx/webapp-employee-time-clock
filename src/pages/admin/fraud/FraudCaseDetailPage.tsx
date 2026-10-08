import { ClipboardList, Gavel, Hand, History, Images, ListChecks, MessageSquarePlus, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { FraudAttempts, FraudEvents } from '../../../components/fraud/FraudAttempts';
import { FraudEvidence } from '../../../components/fraud/FraudEvidence';
import { RiskBadge } from '../../../components/fraud/RiskBadge';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { Button } from '../../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { ResourceFallback } from '../../../components/ui/ResourceFallback';
import { useAction } from '../../../hooks/useAction';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { notifyFraudCasesChanged } from '../../../hooks/usePendingFraudCases';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { fraudCaseService } from '../../../services/fraudCaseService';
import type { FraudCaseDetail } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { formatDateTime } from '../../../utils/format';
import { formatCount } from '../../../utils/numbers';
import { FraudSubject, subjectOf } from './FraudCasesPage';

/** Decisiones que se toman en su formulario (con nota): confirmar, descartar o dejar no concluyente. */
const DECISIONS = [
  { status: 'CONFIRMED', variant: 'danger', Icon: ShieldAlert },
  { status: 'FALSE_POSITIVE', variant: 'success', Icon: ShieldCheck },
  { status: 'INCONCLUSIVE', variant: 'secondary', Icon: ShieldQuestion },
] as const;

const loadError = () => t('fraud.detail.loadError');
const takeError = () => t('fraud.detail.takeError');

/** Tomar el caso: queda "en revisión" a nombre de quien lo toma (sin cambiar nada más). */
function takeConfirm(item: FraudCaseDetail, current: string, next: string): ConfirmInput {
  return {
    kind: 'edit',
    tone: 'primary',
    icon: <Hand size={30} />,
    eyebrow: t('fraud.detail.eyebrow'),
    title: t('fraud.detail.takeTitle', { id: item.id }),
    message: t('fraud.detail.takeMessage'),
    changes: [{ label: t('fraud.list.status'), before: current, after: next }],
    details: [
      { label: t('fraud.list.company'), value: item.company_name },
      { label: t('fraud.list.subject'), value: subjectOf(item) },
    ],
    confirmLabel: t('fraud.detail.take'),
    confirmIcon: <Hand size={18} />,
  };
}

/**
 * Un caso de fraude (ADMIN): de quién y de qué empresa, qué lo abrió, su riesgo, cada intento con sus señales y
 * números, la evidencia (con su confirmación: queda en el historial) y su historial. Desde aquí se toma, se decide
 * (cada decisión es un formulario con nota) o se agrega una nota.
 */
export function FraudCaseDetailPage() {
  const t = useT();
  const caseId = Number(useParams().id);
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const { data: item, setData, error, retry } = useResource((signal) => fraudCaseService.get(caseId, signal), caseId, loadError);
  const { busy, run } = useAction();

  if (!item) {
    return <ResourceFallback error={error} retry={retry} lines={8} header={{ title: t('fraud.detail.title', { id: caseId }), backTo: paths.admin.fraudCases, backLabel: t('fraud.title') }} />;
  }

  const take = () =>
    void run(() => fraudCaseService.decide(item.id, { status: 'IN_REVIEW' }), {
      confirm: () => takeConfirm(item, nameOf('fraud_case_statuses', item.status), nameOf('fraud_case_statuses', 'IN_REVIEW')),
      errorTitle: takeError,
      onSuccess: (saved) => {
        setData(saved);
        notifyFraudCasesChanged();
      },
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('fraud.detail.title', { id: item.id })}
          subtitle={`${item.reason_name} · ${item.company_name}`}
          backTo={paths.admin.fraudCases}
          backLabel={t('fraud.title')}
          actions={
            <>
              <RiskBadge tier={item.tier} score={item.max_score} />
              <CatalogStatusBadge catalog="fraud_case_statuses" code={item.status} />
            </>
          }
        />
        <PanelSection title={t('fraud.detail.review')} icon={<Gavel size={20} />}>
          <p className="muted small">
            {item.decided_by ? t('fraud.detail.decided', { who: item.decided_by, date: formatDateTime(item.decided_at) }) : t('fraud.detail.undecided')}
            {item.decision_note && ` · ${item.decision_note}`}
          </p>
          <p className="muted small">{t('fraud.detail.consequences')}</p>
          <div className="button-row">
            {item.status === 'OPEN' && (
              <Button variant="primary" icon={<Hand size={18} />} loading={busy !== null} onClick={take}>
                {t('fraud.detail.take')}
              </Button>
            )}
            {DECISIONS.filter((decision) => decision.status !== item.status).map(({ status, variant, Icon }) => (
              <Button key={status} variant={variant} icon={<Icon size={18} />} disabled={busy !== null} onClick={() => void navigate(paths.admin.fraudCaseDecision(item.id, status))}>
                {t(`fraud.decision.actions.${status}`)}
              </Button>
            ))}
            <Button variant="ghost" icon={<MessageSquarePlus size={18} />} disabled={busy !== null} onClick={() => void navigate(paths.admin.fraudCaseNote(item.id))}>
              {t('fraud.detail.addNote')}
            </Button>
          </div>
        </PanelSection>
        <PanelGrid>
          <PanelSection title={t('fraud.detail.data')} icon={<ClipboardList size={20} />}>
            <dl className="details">
              <div>
                <dt>{t('fraud.list.company')}</dt>
                <dd>{item.company_name}</dd>
              </div>
              <div>
                <dt>{t('fraud.list.subject')}</dt>
                <dd>
                  <FraudSubject item={item} />
                </dd>
              </div>
              <div>
                <dt>{t('fraud.list.kind')}</dt>
                <dd>{nameOf('fraud_kinds', item.kind)}</dd>
              </div>
              <div>
                <dt>{t('fraud.detail.reason')}</dt>
                <dd>{item.reason_name}</dd>
              </div>
              <div>
                <dt>{t('fraud.list.attempts')}</dt>
                <dd>{formatCount(item.attempts)}</dd>
              </div>
              <div>
                <dt>{t('fraud.detail.opened')}</dt>
                <dd>{formatDateTime(item.created_at)}</dd>
              </div>
              <div>
                <dt>{t('fraud.list.last')}</dt>
                <dd>{formatDateTime(item.last_attempt_at)}</dd>
              </div>
            </dl>
          </PanelSection>
          <PanelSection title={t('fraud.evidence.title')} icon={<Images size={20} />}>
            <FraudEvidence caseId={item.id} items={item.evidence_items} onViewed={retry} />
          </PanelSection>
        </PanelGrid>
        <PanelSection
          title={t('fraud.detail.attempts')}
          icon={<ListChecks size={20} />}
          aside={<span className="muted small">{t('fraud.detail.attemptsShown', { count: item.attempts_detail.length, total: formatCount(item.attempts) })}</span>}
        >
          <FraudAttempts attempts={item.attempts_detail} />
        </PanelSection>
        <PanelSection title={t('fraud.detail.history')} icon={<History size={20} />}>
          <FraudEvents events={item.events} />
        </PanelSection>
      </Panel>
    </div>
  );
}
