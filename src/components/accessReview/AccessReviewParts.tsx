import { ShieldCheck } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { AccessControls, AccessReviewAccount } from '../../types/accessReview';
import { accountFlags, controlRows, FLAG_TONE, lastAccessText, mfaText } from '../../utils/accessReview';
import type { StatusTone } from '../../types/index';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { Avatar } from '../ui/Avatar';
import { PanelSection } from '../ui/Panel';

const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'badge--muted',
  info: 'badge--info',
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
};

/** Lo que hay que atender de una cuenta: bloqueada, sin segundo factor, inactiva o sin entrar nunca. */
export function AccountFlags({ account }: { account: AccessReviewAccount }) {
  const t = useT();
  const flags = accountFlags(account);
  if (flags.length === 0) return <span className={`badge ${TONE_CLASS.success}`}>{t('accessReview.flags.ok')}</span>;
  return (
    <>
      {flags.map((flag) => (
        <span key={flag} className={`badge ${TONE_CLASS[FLAG_TONE[flag]]}`}>
          {t(`accessReview.flags.${flag}`)}
        </span>
      ))}
    </>
  );
}

/** Una cuenta del informe: quién es, su rol y empresa, su último acceso, su segundo factor y su alcance. */
export function AccountCells({ account }: { account: AccessReviewAccount }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <>
      <td className="table__primary">
        <span className="row" style={{ gap: 8 }}>
          <Avatar name={account.email} size="xs" decorative />
          {account.email}
        </span>
      </td>
      <td data-label={t('accessReview.columns.role')}>
        {nameOf('roles', account.role)}
        <small className="muted table__note">{account.company?.name ?? t('accessReview.platform')}</small>
      </td>
      <td data-label={t('accessReview.columns.lastAccess')}>
        {lastAccessText(account)}
        <small className="muted table__note">{t('accessReview.createdAt', { date: formatDate(account.created_at) })}</small>
      </td>
      <td data-label={t('accessReview.columns.mfa')}>
        {mfaText(account)}
        {account.locked_until && <small className="muted table__note">{t('accessReview.lockedUntil', { date: formatDateTime(account.locked_until) })}</small>}
      </td>
      <td data-label={t('accessReview.columns.scope')}>
        {t('accessReview.sessions', { count: account.open_sessions })}
        <small className="muted table__note">{t('accessReview.employments', { count: account.employments })}</small>
      </td>
      <td data-label={t('accessReview.columns.flags')}>
        <AccountFlags account={account} />
      </td>
    </>
  );
}

/**
 * Los controles DECLARADOS que acompañan al informe: contraseñas, Argon2id, bloqueo de la cuenta y caducidad de
 * la sesión. Los envía el SERVIDOR desde su código vigente; la app solo los dibuja (nunca los escribe ni los
 * calcula), que es justo lo que hace que sirvan como evidencia.
 */
export function AccessControlsPanel({ controls, generatedAt }: { controls: AccessControls; generatedAt: string }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const rows = controlRows(controls, (role) => nameOf('roles', role));
  return (
    <PanelSection title={t('accessReview.controls.title')} icon={<ShieldCheck size={20} />}>
      <p className="muted small">{t('accessReview.controls.intro', { date: formatDateTime(generatedAt) })}</p>
      <dl className="details">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  );
}

/** Cuentas por rol, como el auditor las cuenta (los nombres salen del catálogo `roles`). */
export function RoleCounts({ byRole }: { byRole: Record<string, number> }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const entries = Object.entries(byRole);
  if (entries.length === 0) return <p className="muted small">{t('accessReview.noAccounts')}</p>;
  return (
    <div className="row">
      {entries.map(([role, count]) => (
        <span key={role} className="badge badge--info badge--plain">
          {nameOf('roles', role)}: {formatCount(count)}
        </span>
      ))}
    </div>
  );
}
