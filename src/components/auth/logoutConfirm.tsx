import { Clock, LogOut, MonitorSmartphone, MonitorX } from 'lucide-react';
import { useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { t, useT } from '../../i18n';
import type { User } from '../../types';
import { formatDateTime, timeAgo } from '../../utils/format';
import { describeDevice } from '../../utils/userAgent';
import type { MessageInput } from '../MessageDialog';
import { Avatar } from '../ui/Avatar';

/** La cuenta que se cierra: quién es, en qué empresa y desde qué dispositivo. */
function LogoutCard({ user, role }: { user: User; role: string }) {
  const t = useT();
  const name = user.employee?.full_name ?? user.email;
  const device = describeDevice(navigator.userAgent);
  return (
    <div className="logout-card">
      <div className="logout-card__who">
        <Avatar name={name} src={user.avatar} className="logout-card__avatar" decorative />
        <span className="logout-card__identity">
          <strong className="truncate">{name}</strong>
          {name !== user.email && <span className="muted small truncate">{user.email}</span>}
          <span className="logout-card__role">{[role, user.company?.name].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      <dl className="logout-card__session">
        <div>
          <dt>
            <MonitorSmartphone size={16} aria-hidden /> {t('auth.logout.thisDevice')}
          </dt>
          <dd>{device.label}</dd>
        </div>
        {user.last_login_at && (
          <div>
            <dt>
              <Clock size={16} aria-hidden /> {t('auth.logout.lastLogin')}
            </dt>
            <dd title={formatDateTime(user.last_login_at)}>{timeAgo(user.last_login_at)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Popup "¿Cerrar sesión?" con la cuenta y lo que implica salir según el
 * rol, en el idioma activo (quien lo abre lo pide al dibujarse para que siga al idioma).
 */
export function logoutMessage(user: User, role: string): MessageInput {
  return {
    variant: 'warning',
    icon: <LogOut size={30} />,
    eyebrow: t('common.actions.logout'),
    title: t('auth.logout.title'),
    text: t(`auth.logout.consequence.${user.role}`),
    body: <LogoutCard user={user} role={role} />,
    actions: [
      { id: 'stay', label: t('auth.logout.stay'), variant: 'ghost' },
      { id: 'everywhere', label: t('auth.logout.everywhere'), variant: 'danger-outline', icon: <MonitorX size={18} /> },
      { id: 'logout', label: t('common.actions.logout'), variant: 'danger', icon: <LogOut size={18} /> },
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
    const role = nameOf('roles', user.role);
    const choice = await feedback.show(() => logoutMessage(user, role));
    if (choice === 'logout') {
      await logout();
    } else if (choice === 'everywhere') {
      try {
        await logoutEverywhere();
      } catch (error) {
        void feedback.fromError(error, { title: () => t('auth.logout.everywhereFailed') });
      }
    }
  }, [user, logout, logoutEverywhere, feedback, nameOf]);
}
