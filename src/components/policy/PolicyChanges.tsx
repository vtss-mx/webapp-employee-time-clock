import { CheckCheck, History, ShieldQuestion, Undo2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { AdminVerificationPolicy, PolicyChange, PolicyUpdateResult } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatDateTime } from '../../utils/format';
import { CatalogStatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { describeFieldChange } from './policyFields';
import { SimulationSummary } from './RiskSimulation';

const loadError = () => t('policy.changes.loadError');
const approveError = () => t('policy.changes.approveError');
const cancelError = () => t('policy.changes.cancelError');

type Catalogs = Pick<CatalogApi, 'accessories' | 'nameOf'>;

/** Aprobar el cambio de otro ADMIN: cada campo "antes → después", quién lo pidió y por qué; aplica al instante. */
function approveConfirm(change: PolicyChange, policy: AdminVerificationPolicy, catalogs: Catalogs, company: string): ConfirmInput {
  return {
    kind: 'edit',
    tone: 'warning',
    icon: <ShieldQuestion size={30} />,
    eyebrow: t('policy.changes.eyebrow'),
    title: t('policy.changes.approveTitle', { who: change.requested_by }),
    message: change.reason ?? t('policy.changes.noReason'),
    changes: change.changes.map((field) => describeFieldChange(field, policy, catalogs)),
    note: t('policy.changes.approveNote', { company }),
    confirmLabel: t('policy.changes.approve'),
    confirmIcon: <CheckCheck size={18} />,
  };
}

/** Retirar un cambio propio que nadie ha aprobado (la política no cambia). */
function cancelConfirm(change: PolicyChange, policy: AdminVerificationPolicy, catalogs: Catalogs): ConfirmInput {
  return {
    kind: 'action',
    tone: 'danger',
    icon: <Undo2 size={30} />,
    eyebrow: t('policy.changes.eyebrow'),
    title: t('policy.changes.cancelTitle'),
    message: t('policy.changes.cancelMessage'),
    details: change.changes.map((field) => {
      const { label, before, after } = describeFieldChange(field, policy, catalogs);
      return { label, value: `${before} → ${after}` };
    }),
    confirmLabel: t('policy.changes.cancel'),
    confirmIcon: <Undo2 size={18} />,
  };
}

interface PolicyChangesProps {
  companyId: number;
  companyName: string;
  policy: AdminVerificationPolicy;
  /** Cambia cuando la pantalla pidió un cambio: la lista se vuelve a pedir. */
  version: number;
  /** Se aprobó un cambio: la política ya lo aplica. */
  onApproved: (result: PolicyUpdateResult) => void;
  /** Se retiró un cambio pendiente propio (la política sigue igual; un pendiente menos). */
  onCancelled: () => void;
}

/**
 * Historial de la política (solo el ADMIN): quién pidió qué y cuándo, cada campo "antes → después", si relajaba
 * la seguridad y, si tocó el motor, su simulación. Los pendientes (regla de dos personas) los aprueba o rechaza OTRO
 * ADMIN; quien lo pidió solo puede retirarlo. Rechazar es un formulario con motivo (lo lee quien lo pidió).
 */
export function PolicyChanges({ companyId, companyName, policy, version, onApproved, onCancelled }: PolicyChangesProps) {
  const t = useT();
  const catalogs = useCatalogs();
  const navigate = useNavigate();
  const list = usePagedList((query, signal) => adminService.policyChanges(companyId, query, signal), { errorTitle: loadError, filterKey: `${companyId}|${version}`, pageSize: 5 });
  const { busy, run } = useAction<number>();
  const signalName = (code: string) => policy.risk_signals.find((signal) => signal.code === code)?.name ?? code;

  const approve = (change: PolicyChange) =>
    void run(() => adminService.approvePolicyChange(companyId, change.id), {
      busy: change.id,
      confirm: () => approveConfirm(change, policy, catalogs, companyName),
      errorTitle: approveError,
      success: () => [t('policy.changes.approved'), t('policy.changes.approvedText')],
      onSuccess: onApproved,
      // Venció o la política cambió desde que se pidió: el servidor lo canceló; la lista lo muestra.
      onSettled: list.retry,
    });
  const cancel = (change: PolicyChange) =>
    void run(() => adminService.cancelPolicyChange(companyId, change.id), {
      busy: change.id,
      confirm: () => cancelConfirm(change, policy, catalogs),
      errorTitle: cancelError,
      onSuccess: onCancelled,
      onSettled: list.retry,
    });

  return (
    <PagedItems
      list={list}
      pager={{ noun: { one: t('policy.changes.noun.one'), other: t('policy.changes.noun.other') } }}
      empty={{ compact: true, icon: <History />, title: t('policy.changes.emptyTitle'), description: t('policy.changes.emptyDescription') }}
    >
      {(items) => (
        <ul className="log-list log-list--stacked policy-changes">
          {items.map((change) => {
            const pending = change.status === 'PENDING';
            return (
              <li key={change.id}>
                <span className="policy-changes__head">
                  <CatalogStatusBadge catalog="policy_change_statuses" code={change.status} />
                  {change.relaxes && <span className="badge badge--danger">{t('policy.changes.relaxes')}</span>}
                  {change.preset && <span className="badge badge--info">{catalogs.nameOf('policy_presets', change.preset)}</span>}
                  <span className="small muted">{t('policy.changes.requested', { who: change.requested_by, date: formatDateTime(change.created_at) })}</span>
                </span>
                {change.reason && <span className="small">{t('policy.changes.reason', { reason: change.reason })}</span>}
                <ul className="policy-changes__fields">
                  {change.changes.map((field) => {
                    const { label, before, after } = describeFieldChange(field, policy, catalogs);
                    return (
                      <li key={field.field} className={field.relaxes ? 'text-danger' : undefined}>
                        <strong>{label}:</strong> {before} → {after}
                      </li>
                    );
                  })}
                </ul>
                {change.simulation && <SimulationSummary simulation={change.simulation} signalName={signalName} />}
                {pending && change.expires_at && <span className="small muted">{t('policy.changes.expires', { date: formatDateTime(change.expires_at) })}</span>}
                {change.decided_by && (
                  <span className="small muted">
                    {t('policy.changes.decided', { who: change.decided_by, date: formatDateTime(change.decided_at) })}
                    {change.decision_note && ` · ${change.decision_note}`}
                  </span>
                )}
                {pending && (
                  <span className="button-row">
                    {change.requested_by_me ? (
                      <Button variant="ghost" size="sm" icon={<Undo2 size={16} />} loading={busy === change.id} disabled={busy !== null} onClick={() => cancel(change)}>
                        {t('policy.changes.cancel')}
                      </Button>
                    ) : (
                      <>
                        <Button variant="success" size="sm" icon={<CheckCheck size={16} />} loading={busy === change.id} disabled={busy !== null} onClick={() => approve(change)}>
                          {t('policy.changes.approve')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<XCircle size={16} />}
                          disabled={busy !== null}
                          onClick={() => void navigate(paths.admin.rejectPolicyChange(companyId, change.id))}
                        >
                          {t('policy.changes.reject')}
                        </Button>
                      </>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PagedItems>
  );
}
