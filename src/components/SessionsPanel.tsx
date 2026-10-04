import { Laptop, LogOut, MonitorSmartphone, ShieldAlert, Smartphone } from 'lucide-react';
import { useAction } from '../hooks/useAction';
import { useAuth } from '../hooks/useAuth';
import { usePagedList } from '../hooks/usePagedList';
import { authService } from '../services/authService';
import { formatDateTime, timeAgo } from '../utils/format';
import type { DeviceSession } from '../types';
import { describeDevice } from '../utils/userAgent';
import { Button } from './ui/Button';
import { PagedItems } from './ui/PagedItems';
import { PanelSection } from './ui/Panel';

/** Sección "Sesiones activas" (dispositivos) con revocación individual o total. */
export function SessionsPanel() {
  const { logoutEverywhere } = useAuth();
  const list = usePagedList((page, signal) => authService.sessions(page, signal), { errorTitle: 'No se pudieron cargar tus sesiones' });
  const { busy, run } = useAction<string>();

  const revoke = (session: DeviceSession, device: string) =>
    run(() => authService.revokeSession(session.id), {
      busy: session.id,
      confirm: {
        kind: 'delete',
        icon: <LogOut size={30} />,
        eyebrow: 'Sesión activa',
        title: `¿Cerrar la sesión de ${device}?`,
        message: 'Ese dispositivo deberá iniciar sesión de nuevo para usar tu cuenta.',
        details: [
          { label: 'IP', value: session.ip_address ?? 'Desconocida' },
          { label: 'Inició', value: formatDateTime(session.created_at) },
        ],
        confirmLabel: 'Cerrar sesión',
        confirmIcon: <LogOut size={18} />,
      },
      errorTitle: 'No se pudo cerrar la sesión',
      success: ['Sesión cerrada', 'Ese dispositivo deberá iniciar sesión de nuevo.'],
      onSuccess: list.retry,
    });

  // Al salir bien se cierra la sesión (la pantalla se va): sigue ocupada hasta entonces.
  const revokeAll = () =>
    run(logoutEverywhere, {
      busy: 'all',
      confirm: {
        kind: 'delete',
        icon: <LogOut size={30} />,
        eyebrow: 'Todas tus sesiones',
        title: '¿Cerrar la sesión en todos tus dispositivos?',
        message: 'Se cerrará la sesión en todos tus dispositivos, incluido este: tendrás que volver a iniciar sesión.',
        confirmLabel: 'Cerrar todas',
        confirmIcon: <LogOut size={18} />,
      },
      errorTitle: 'No se pudo cerrar sesión en todos los dispositivos',
      keepBusy: true,
    });

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
                  <Button size="sm" variant="ghost" loading={busy === s.id} disabled={busy !== null} onClick={() => void revoke(s, device.label)}>
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
      <Button variant="danger-outline" block icon={<LogOut size={18} />} loading={busy === 'all'} disabled={busy !== null} onClick={() => void revokeAll()}>
        Cerrar sesión en todos los dispositivos
      </Button>
    </PanelSection>
  );
}
