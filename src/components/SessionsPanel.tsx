import { Laptop, LogOut, MonitorSmartphone, ShieldAlert, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';
import { usePagedList } from '../hooks/usePagedList';
import { authService } from '../services/authService';
import { formatDateTime, timeAgo } from '../utils/format';
import { describeDevice } from '../utils/userAgent';
import { ConfirmDialog } from './Modal';
import { Button } from './ui/Button';
import { PagedItems } from './ui/PagedItems';
import { PanelSection } from './ui/Panel';

/** Sección "Sesiones activas" (dispositivos) con revocación individual o total. */
export function SessionsPanel() {
  const { logoutEverywhere } = useAuth();
  const feedback = useFeedback();
  const list = usePagedList((page, signal) => authService.sessions(page, signal), { errorTitle: 'No se pudieron cargar tus sesiones' });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await authService.revokeSession(id);
      void feedback.success('Sesión cerrada', 'Ese dispositivo deberá iniciar sesión de nuevo.');
      list.retry();
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo cerrar la sesión' });
    } finally {
      setBusy(null);
    }
  };

  const revokeAll = async () => {
    setBusy('all');
    try {
      await logoutEverywhere();
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo cerrar sesión en todos los dispositivos' });
      setBusy(null);
      setConfirmAll(false);
    }
  };

  return (
    <PanelSection
      title="Sesiones activas"
      icon={<MonitorSmartphone size={20} />}
      aside={list.data && <span className="badge badge--info">{list.total}</span>}
    >
      <PagedItems
        list={list}
        skeletonRows={2}
        empty={{ compact: true, icon: <MonitorSmartphone />, title: 'No hay sesiones abiertas', description: 'Cada dispositivo en que inicies sesión aparecerá aquí para que puedas cerrarlo.' }}
        pager={{ variant: 'compact', siblings: 0, noun: { one: 'sesión', other: 'sesiones' } }}
      >
        {(sessions) => (
        <ul className={`session-list ${list.loading ? 'is-loading' : ''}`}>
          {sessions.map((s) => {
            const device = describeDevice(s.user_agent);
            const Icon = device.mobile ? Smartphone : Laptop;
            return (
              <li key={s.id} className={s.current ? 'is-current' : ''}>
                <Icon size={22} />
                <span className="session-list__info">
                  <strong>
                    {device.label} {s.current && <span className="badge badge--success">Este dispositivo</span>}
                  </strong>
                  <span className="muted small">
                    {s.ip_address ?? 'IP desconocida'} · Activa {timeAgo(s.last_used_at ?? s.created_at)} · Inició{' '}
                    {formatDateTime(s.created_at)}
                  </span>
                </span>
                {!s.current && (
                  <Button size="sm" variant="ghost" loading={busy === s.id} disabled={busy !== null} onClick={() => void revoke(s.id)}>
                    Cerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        )}
      </PagedItems>
      <p className="inline-note small muted">
        <ShieldAlert size={16} /> ¿No reconoces un dispositivo? Ciérralo y cambia tu contraseña.
      </p>
      <Button variant="danger-outline" block icon={<LogOut size={18} />} disabled={busy !== null} onClick={() => setConfirmAll(true)}>
        Cerrar sesión en todos los dispositivos
      </Button>
      <ConfirmDialog
        open={confirmAll}
        title="Cerrar todas las sesiones"
        message="Se cerrará la sesión en todos tus dispositivos, incluido este. ¿Deseas continuar?"
        confirmLabel="Cerrar todas"
        tone="danger"
        loading={busy === 'all'}
        onConfirm={() => void revokeAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </PanelSection>
  );
}
