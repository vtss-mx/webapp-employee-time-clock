import { Check, Clock, RefreshCw, ScanFace, UserCheck } from 'lucide-react';
import { useCallback } from 'react';
import { FaceStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { StatusMark } from '../../components/ui/StatusMark';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../hooks/useAuth';
import { usePolling } from '../../hooks/usePolling';
import { t, useLocale } from '../../i18n';
import { config } from '../../utils/config';

/** Pantalla de espera mientras COMPANY valida la identidad. Se actualiza sola. */
export function PendingValidationPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce
  const { user, refreshUser } = useAuth();
  const { busy, run } = useAction();

  // Al aprobarse, el backend cambia las pantallas del empleado y la ruta lleva a su nuevo inicio.
  const poll = useCallback(() => refreshUser(), [refreshUser]);
  usePolling(poll, { intervalMs: config.validationStatusPollMs, immediate: false });

  // A mano: si falla (sin red, servidor ocupado) se avisa con su popup; la revisión automática sigue.
  const check = () => run(refreshUser, { errorTitle: () => t('employee.pending.errorTitle') });

  return (
    <div className="page page--narrow page-transition">
      <div className="result-card">
        <StatusMark kind="pending" />
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ justifySelf: 'center' }}>
            <FaceStatusBadge status="PENDING_REVIEW" />
          </span>
          <h1>{t('employee.pending.title')}</h1>
          <p className="muted">{t('employee.pending.text', { name: user?.employee?.first_name ?? '' })}</p>
        </div>

        <ol className="timeline">
          <li className="is-done">
            <span className="timeline__dot">
              <Check size={16} />
            </span>
            <div>
              <strong>{t('employee.pending.sent.title')}</strong>
              <span className="muted small">{t('employee.pending.sent.text')}</span>
            </div>
          </li>
          <li className="is-current">
            <span className="timeline__dot">
              <Clock size={16} />
            </span>
            <div>
              <strong>{t('employee.pending.review.title')}</strong>
              <span className="muted small">{t('employee.pending.review.text')}</span>
            </div>
          </li>
          <li>
            <span className="timeline__dot">
              <UserCheck size={16} />
            </span>
            <div>
              <strong>{t('employee.pending.access.title')}</strong>
              <span className="muted small">{t('employee.pending.access.text')}</span>
            </div>
          </li>
        </ol>

        <Button variant="secondary" size="lg" block loading={busy !== null} icon={<RefreshCw size={18} />} onClick={() => void check()}>
          {t('employee.pending.refresh')}
        </Button>
        <p className="inline-note inline-note--center small muted">
          <ScanFace size={16} /> {t('employee.pending.auto')}
        </p>
      </div>
    </div>
  );
}
