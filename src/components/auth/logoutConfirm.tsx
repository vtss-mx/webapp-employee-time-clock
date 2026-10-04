import { Clock, LogOut, MonitorSmartphone, MonitorX } from 'lucide-react';
import { useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import type { Role, User } from '../../types';
import { formatDateTime, initials, timeAgo } from '../../utils/format';
import { describeDevice } from '../../utils/userAgent';
import type { MessageInput } from '../MessageDialog';

/** Qué deja de pasar al salir, según lo que hace cada rol en la aplicación. */
const CONSEQUENCE: Record<Role, string> = {
  EMPLOYEE: 'Para identificarte o mostrar tu código QR tendrás que volver a iniciar sesión.',
  VALIDATOR: 'Este punto de control dejará de identificar al personal hasta que alguien vuelva a iniciar sesión en este dispositivo.',
  COMPANY: 'Tu trabajo ya está guardado. Para administrar tu empresa tendrás que volver a iniciar sesión.',
  ADMIN: 'Tu trabajo ya está guardado. Para administrar la plataforma tendrás que volver a iniciar sesión.',
};

/** La cuenta que se cierra: quién es, en qué empresa y desde qué dispositivo. */
function LogoutCard({ user, role }: { user: User; role: string }) {
  const name = user.employee?.full_name ?? user.email;
  const device = describeDevice(navigator.userAgent);
  return (
    <div className="logout-card">
      <div className="logout-card__who">
        <span className="avatar logout-card__avatar" aria-hidden>
          {initials(name)}
        </span>
        <span className="logout-card__identity">
          <strong className="truncate">{name}</strong>
          {name !== user.email && <span className="muted small truncate">{user.email}</span>}
          <span className="logout-card__role">{[role, user.company?.name].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      <dl className="logout-card__session">
        <div>
          <dt>
            <MonitorSmartphone size={16} aria-hidden /> Este dispositivo
          </dt>
          <dd>{device.label}</dd>
        </div>
        {user.last_login_at && (
          <div>
            <dt>
              <Clock size={16} aria-hidden /> Último inicio de sesión
            </dt>
            <dd title={formatDateTime(user.last_login_at)}>{timeAgo(user.last_login_at)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Popup "¿Estás seguro de que deseas cerrar sesión?" con la cuenta y lo que implica salir. */
export function logoutMessage(user: User, role: string): MessageInput {
  return {
    variant: 'warning',
    icon: <LogOut size={30} />,
    eyebrow: 'Cerrar sesión',
    title: '¿Estás seguro de que deseas cerrar sesión?',
    text: CONSEQUENCE[user.role],
    body: <LogoutCard user={user} role={role} />,
    actions: [
      { id: 'stay', label: 'Seguir aquí', variant: 'ghost' },
      { id: 'everywhere', label: 'Salir de todos mis dispositivos', variant: 'danger-outline', icon: <MonitorX size={18} /> },
      { id: 'logout', label: 'Cerrar sesión', variant: 'danger', icon: <LogOut size={18} /> },
    ],
    key: 'confirm-logout',
  };
}

/**
 * Cerrar sesión SIEMPRE con confirmación: muestra el popup y, según lo elegido, cierra la sesión de
 * este dispositivo, la de todos o no hace nada. Las salidas forzadas (sesión vencida, dispositivo no
 * permitido) no pasan por aquí.
 */
export function useConfirmLogout() {
  const { user, logout, logoutEverywhere } = useAuth();
  const feedback = useFeedback();
  const { nameOf } = useCatalogs();
  return useCallback(async () => {
    if (!user) return;
    const choice = await feedback.show(logoutMessage(user, nameOf('roles', user.role)));
    if (choice === 'logout') {
      await logout();
    } else if (choice === 'everywhere') {
      try {
        await logoutEverywhere();
      } catch (error) {
        void feedback.fromError(error, { title: 'No se pudo cerrar sesión en todos los dispositivos' });
      }
    }
  }, [user, logout, logoutEverywhere, feedback, nameOf]);
}
