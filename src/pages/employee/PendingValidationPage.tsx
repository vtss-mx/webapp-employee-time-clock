import { Check, Clock, RefreshCw, ScanFace, UserCheck } from 'lucide-react';
import { useCallback } from 'react';
import { FaceStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { StatusMark } from '../../components/ui/StatusMark';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../hooks/useAuth';
import { usePolling } from '../../hooks/usePolling';
import { config } from '../../utils/config';

/** Pantalla de espera mientras COMPANY valida la identidad. Se actualiza sola. */
export function PendingValidationPage() {
  const { user, refreshUser } = useAuth();
  const { busy, run } = useAction();

  // Al aprobarse, el backend cambia las pantallas del empleado y la ruta lleva a su nuevo inicio.
  const poll = useCallback(() => refreshUser(), [refreshUser]);
  usePolling(poll, { intervalMs: config.validationStatusPollMs, immediate: false });

  // A mano: si falla (sin red, servidor ocupado) se avisa con su popup; la revisión automática sigue.
  const check = () => run(refreshUser, { errorTitle: 'No se pudo actualizar el estado' });

  return (
    <div className="page page--narrow page-transition">
      <div className="result-card">
        <StatusMark kind="pending" />
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ justifySelf: 'center' }}>
            <FaceStatusBadge status="PENDING_REVIEW" />
          </span>
          <h1>Estamos validando tu identidad</h1>
          <p className="muted">
            {user?.employee?.first_name}, tu registro facial se envió correctamente. Un administrador de tu empresa lo
            revisará y te avisaremos aquí en cuanto quede aprobado.
          </p>
        </div>

        <ol className="timeline">
          <li className="is-done">
            <span className="timeline__dot">
              <Check size={16} />
            </span>
            <div>
              <strong>Registro facial enviado</strong>
              <span className="muted small">Rostro, prueba de vida y calidad verificados.</span>
            </div>
          </li>
          <li className="is-current">
            <span className="timeline__dot">
              <Clock size={16} />
            </span>
            <div>
              <strong>Validación por tu empresa</strong>
              <span className="muted small">Un administrador confirma que eres tú.</span>
            </div>
          </li>
          <li>
            <span className="timeline__dot">
              <UserCheck size={16} />
            </span>
            <div>
              <strong>Acceso habilitado</strong>
              <span className="muted small">Podrás identificarte con tu rostro o tu código QR.</span>
            </div>
          </li>
        </ol>

        <Button variant="secondary" size="lg" block loading={busy !== null} icon={<RefreshCw size={18} />} onClick={() => void check()}>
          Actualizar estado
        </Button>
        <p className="inline-note inline-note--center small muted">
          <ScanFace size={16} /> Esta pantalla se actualiza automáticamente.
        </p>
      </div>
    </div>
  );
}
