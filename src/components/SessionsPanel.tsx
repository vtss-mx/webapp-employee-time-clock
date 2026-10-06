import { Laptop, LogOut, MonitorSmartphone, ShieldAlert, Smartphone } from 'lucide-react';
import { useAction } from '../hooks/useAction';
import { useAuth } from '../hooks/useAuth';
import { usePagedList } from '../hooks/usePagedList';
import { t, useT } from '../i18n';
import { authService } from '../services/authService';
import { formatDateTime, timeAgo } from '../utils/format';
import type { DeviceSession } from '../types';
import { describeDevice } from '../utils/userAgent';
import { Button } from './ui/Button';
import { PagedItems } from './ui/PagedItems';
import { PanelSection } from './ui/Panel';

/** Sección "Sesiones activas" (dispositivos) con revocación individual o total. */
export function SessionsPanel() {
  // Redibuja al cambiar el idioma. Los textos salen de `t` (el idioma activo al llamarse), también los
  // de los popups, que se arman al dibujarse: una función creada ahora no se queda con el idioma de hoy.
  useT();
  const { logoutEverywhere } = useAuth();
  const list = usePagedList((page, signal) => authService.sessions(page, signal), { errorTitle: () => t('profile.sessions.loadFailed') });
  const { busy, run } = useAction<string>();

  // Las confirmaciones y avisos se arman al dibujarse: siguen al idioma activo con el popup abierto.
  const revoke = (session: DeviceSession) =>
    run(() => authService.revokeSession(session.id), {
      busy: session.id,
      confirm: () => ({
        kind: 'delete',
        icon: <LogOut size={30} />,
        eyebrow: t('profile.sessions.revoke.eyebrow'),
        title: t('profile.sessions.revoke.title', { device: describeDevice(session.user_agent).label }),
        message: t('profile.sessions.revoke.message'),
        details: [
          { label: t('profile.sessions.revoke.ip'), value: session.ip_address ?? t('profile.sessions.revoke.unknown') },
          { label: t('profile.sessions.revoke.started'), value: formatDateTime(session.created_at) },
        ],
        confirmLabel: t('common.actions.logout'),
        confirmIcon: <LogOut size={18} />,
      }),
      errorTitle: () => t('profile.sessions.revoke.failed'),
      success: () => [t('profile.sessions.revoke.done'), t('profile.sessions.revoke.doneText')],
      onSuccess: list.retry,
    });

  // Al salir bien se cierra la sesión (la pantalla se va): sigue ocupada hasta entonces.
  const revokeAll = () =>
    run(logoutEverywhere, {
      busy: 'all',
      confirm: () => ({
        kind: 'delete',
        icon: <LogOut size={30} />,
        eyebrow: t('profile.sessions.revokeAllAsk.eyebrow'),
        title: t('profile.sessions.revokeAllAsk.title'),
        message: t('profile.sessions.revokeAllAsk.message'),
        confirmLabel: t('profile.sessions.revokeAllAsk.confirm'),
        confirmIcon: <LogOut size={18} />,
      }),
      errorTitle: () => t('profile.sessions.revokeAllAsk.failed'),
      keepBusy: true,
    });

  return (
    <PanelSection
      title={t('profile.sessions.title')}
      icon={<MonitorSmartphone size={20} />}
      aside={list.data && <span className="badge badge--info">{list.total}</span>}
    >
      <PagedItems
        list={list}
        skeletonRows={2}
        empty={{ compact: true, icon: <MonitorSmartphone />, title: t('profile.sessions.empty.title'), description: t('profile.sessions.empty.description') }}
        pager={{ variant: 'compact', siblings: 0, noun: { one: t('profile.sessions.noun.one'), other: t('profile.sessions.noun.other') } }}
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
                    {device.label} {s.current && <span className="badge badge--success">{t('profile.sessions.thisDevice')}</span>}
                  </strong>
                  <span className="muted small">
                    {t('profile.sessions.activity', {
                      ip: s.ip_address ?? t('profile.sessions.unknownIp'),
                      ago: timeAgo(s.last_used_at ?? s.created_at),
                      started: formatDateTime(s.created_at),
                    })}
                  </span>
                </span>
                {!s.current && (
                  <Button size="sm" variant="ghost" loading={busy === s.id} disabled={busy !== null} onClick={() => void revoke(s)}>
                    {t('common.actions.close')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        )}
      </PagedItems>
      <p className="inline-note small muted">
        <ShieldAlert size={16} /> {t('profile.sessions.hint')}
      </p>
      <Button variant="danger-outline" block icon={<LogOut size={18} />} loading={busy === 'all'} disabled={busy !== null} onClick={() => void revokeAll()}>
        {t('profile.sessions.revokeAll')}
      </Button>
    </PanelSection>
  );
}
