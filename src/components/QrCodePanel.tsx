import { Ban, QrCode, RefreshCw } from 'lucide-react';
import { useAction } from '../hooks/useAction';
import { useResource } from '../hooks/useResource';
import { useVerificationPolicy } from '../hooks/useVerificationPolicy';
import { t, useLocale } from '../i18n';
import { employeeService } from '../services/employeeService';
import { formatDateTime, timeAgo } from '../utils/format';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

/**
 * Sección "Código QR" del detalle de un empleado. El QR es dinámico: el empleado lo genera en su
 * teléfono, cambia cada pocos segundos y sirve una sola vez, así que la empresa no lo ve ni lo
 * imprime. Aquí ve su actividad y puede invalidar el vigente (su teléfono muestra otro).
 */
export function QrCodePanel({ employeeId }: { employeeId: number }) {
  useLocale(); // textos con `t` al dibujarse; los popups reciben funciones y siguen al idioma abiertos
  const { policy } = useVerificationPolicy();
  const { data: summary, setData, error, retry } = useResource((signal) => employeeService.qrSummary(employeeId, signal), employeeId, () => t('qr.panel.errorTitle'));
  const action = useAction();
  const busy = action.busy !== null;

  const revoke = () =>
    action.run(() => employeeService.revokeQr(employeeId), {
      confirm: () => ({
        kind: 'delete',
        icon: <Ban size={30} />,
        eyebrow: t('qr.panel.revoke.eyebrow'),
        title: t('qr.panel.revoke.title'),
        message: t('qr.panel.revoke.message'),
        confirmLabel: t('qr.panel.revoke.confirm'),
        confirmIcon: <Ban size={18} />,
      }),
      errorTitle: () => t('qr.panel.revoke.error'),
      success: () => [t('qr.panel.revoke.done'), t('qr.panel.revoke.doneText')],
      onSuccess: setData,
    });

  const live = summary?.live ?? false;
  return (
    <PanelSection
      title={t('qr.panel.title')}
      icon={<QrCode size={20} />}
      aside={summary && <span className={`badge ${live ? 'badge--success badge--live' : 'badge--muted'}`}>{live ? t('qr.panel.live') : t('qr.panel.none')}</span>}
    >
      <p className="muted">{t('qr.panel.intro', { seconds: policy.qr_lifetime_seconds })}</p>
      {!summary && error ? <RetryState onRetry={retry} /> : null}
      {summary && (
        <dl className="details">
          <div>
            <dt>{t('qr.panel.liveUntil')}</dt>
            <dd>{summary.live_until ? formatDateTime(summary.live_until) : '—'}</dd>
          </div>
          <div>
            <dt>{t('qr.panel.lastIssued')}</dt>
            <dd title={summary.last_issued_at ? formatDateTime(summary.last_issued_at) : undefined}>{summary.last_issued_at ? timeAgo(summary.last_issued_at) : t('qr.panel.never')}</dd>
          </div>
          <div>
            <dt>{t('qr.panel.lastUsed')}</dt>
            <dd title={summary.last_used_at ? formatDateTime(summary.last_used_at) : undefined}>{summary.last_used_at ? timeAgo(summary.last_used_at) : t('qr.panel.never')}</dd>
          </div>
        </dl>
      )}
      <div className="button-row">
        <Button variant="secondary" icon={<RefreshCw size={18} />} disabled={busy} onClick={retry}>
          {t('common.actions.refresh')}
        </Button>
        <Button variant="danger-outline" icon={<Ban size={18} />} loading={busy} disabled={!live} onClick={() => void revoke()}>
          {t('qr.panel.revoke.action')}
        </Button>
      </div>
    </PanelSection>
  );
}
