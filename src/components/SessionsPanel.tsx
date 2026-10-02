import { Laptop, LogOut, MonitorSmartphone, ShieldAlert, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useErrorPopup, useFeedback } from '../hooks/useFeedback';
import { RetryState } from './ui/RetryState';
import { authService } from '../services/authService';
import type { DeviceSession } from '../types';
import { formatDateTime, timeAgo } from '../utils/format';
import { ConfirmDialog } from './Modal';
import { SkeletonRows } from './ui/Skeleton';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';

/** Descripción legible del navegador y sistema a partir del User-Agent. */
export function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: 'Dispositivo desconocido', mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Navegador';
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Sistema desconocido';
  return { label: `${browser} · ${os}`, mobile: /Mobile|Android|iPhone|iPad/.test(userAgent) };
}

/** Sección "Sesiones activas" (dispositivos) con revocación individual o total. */
export function SessionsPanel() {
  const { logoutEverywhere } = useAuth();
  const feedback = useFeedback();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await authService.sessions());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);
  useErrorPopup(error, { title: 'No se pudieron cargar tus sesiones', retry: () => void load() });

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await authService.revokeSession(id);
      feedback.success('Sesión cerrada', 'Ese dispositivo deberá iniciar sesión de nuevo.');
      await load();
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
      aside={sessions && <span className="badge badge--info">{sessions.length}</span>}
    >
      {Boolean(error) && !sessions && <RetryState onRetry={() => void load()} />}
      {!sessions && !error && <SkeletonRows rows={2} />}
      {sessions && (
        <ul className="session-list">
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
