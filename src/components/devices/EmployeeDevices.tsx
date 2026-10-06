import { Check, MonitorSmartphone, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react';
import { DeviceStatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useLocale } from '../../i18n';
import type { EmployeeDeviceDecision } from '../../services/employeeDeviceService';
import type { DeviceStatus, EmployeeDevice, EmployeeDeviceList, PageQuery } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';

/** Decisiones de la empresa según el estado (las mismas reglas que el backend: `employee_devices.TRANSITIONS`). */
const NEXT: Record<DeviceStatus, EmployeeDeviceDecision[]> = {
  PENDING: ['APPROVED', 'REVOKED'],
  APPROVED: ['REVOKED'],
  REVOKED: ['APPROVED'],
  REJECTED: ['APPROVED'],
};
const LOOK: Record<EmployeeDeviceDecision, { key: 'approve' | 'revoke'; Icon: LucideIcon }> = {
  APPROVED: { key: 'approve', Icon: Check },
  REVOKED: { key: 'revoke', Icon: ShieldOff },
};

/** Cuándo se usó por primera y por última vez, cuántas veces y si superó un paso más (en una línea). */
export function deviceFacts(device: EmployeeDevice): string {
  return [
    t('devices.firstSeen', { date: formatDateTime(device.first_seen_at) }),
    t('devices.lastSeen', { date: formatDateTime(device.last_seen_at) }),
    t('devices.uses', { count: device.uses }),
    device.stepped_up_at && t('devices.steppedUp', { date: formatDateTime(device.stepped_up_at) }),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Aprobar o revocar se confirma: el dispositivo, su estado "antes → después" y qué implica para sus registros. */
export function decisionConfirm(device: EmployeeDevice, decision: EmployeeDeviceDecision, statusName: (status: DeviceStatus) => string): ConfirmInput {
  const { key, Icon } = LOOK[decision];
  return {
    tone: decision === 'APPROVED' ? 'success' : 'danger',
    icon: <Icon size={30} />,
    eyebrow: t('devices.eyebrow'),
    title: t(`devices.${key}.title`, { name: device.name }),
    message: t(`devices.${key}.message`),
    changes: [{ label: t('common.fields.status'), before: statusName(device.status), after: statusName(decision) }],
    details: [deviceFacts(device)],
    confirmLabel: t(`devices.${key}.label`),
    confirmIcon: <Icon size={18} />,
  };
}

interface EmployeeDevicesProps {
  /** De dónde salen (la ficha del empleado o Mi perfil) y su llave de recarga. */
  load: (query: PageQuery, signal: AbortSignal) => Promise<EmployeeDeviceList>;
  filterKey: string;
  /** Solo la empresa decide; sin esto la lista es de solo lectura (Mi perfil). */
  decide?: (device: EmployeeDevice, decision: EmployeeDeviceDecision) => Promise<EmployeeDevice>;
}

/**
 * Los dispositivos desde los que un empleado checa o verifica su identidad (antifraude 1b, decisión D2): nombre,
 * estado del catálogo `device_statuses`, primer y último uso y si superó un paso más. La empresa los aprueba o revoca
 * (con confirmación; el cambio se ve en la lista, sin aviso de más); el empleado solo los ve.
 */
export function EmployeeDevices({ load, filterKey, decide }: EmployeeDevicesProps) {
  useLocale(); // los textos se escriben al dibujarse: un cambio de idioma los traduce
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction<number>();
  const list = usePagedList(load, { errorTitle: () => t('devices.loadError'), filterKey });

  const change = (device: EmployeeDevice, decision: EmployeeDeviceDecision, apply: NonNullable<EmployeeDevicesProps['decide']>) =>
    run(() => apply(device, decision), {
      busy: device.id,
      confirm: () => decisionConfirm(device, decision, (status) => nameOf('device_statuses', status)),
      errorTitle: () => t('devices.error'),
      onSuccess: (saved) => list.updateItems((items) => items.map((item) => (item.id === saved.id ? saved : item))),
    });

  return (
    <PagedItems
      list={list}
      skeletonRows={2}
      empty={{ compact: true, icon: <MonitorSmartphone />, title: t('devices.empty.title'), description: t('devices.empty.description') }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: t('devices.noun.one'), other: t('devices.noun.other') } }}
    >
      {(items) => (
        <ul className={`log-list device-list ${list.loading ? 'is-loading' : ''}`}>
          {items.map((device) => (
            <li key={device.id}>
              <span className="icon-tile" aria-hidden>
                {device.status === 'APPROVED' ? <ShieldCheck size={18} /> : <MonitorSmartphone size={18} />}
              </span>
              <div className="device-list__info">
                <strong className="truncate">{device.name}</strong> <DeviceStatusBadge status={device.status} />
                <div className="muted small">{deviceFacts(device)}</div>
                {device.reviewed_by && <div className="muted small">{t('devices.reviewedBy', { name: device.reviewed_by })}</div>}
              </div>
              {decide && (
                <span className="device-list__actions">
                  {NEXT[device.status].map((decision) => {
                    const { key, Icon } = LOOK[decision];
                    const label = t(`devices.${key}.label`);
                    return (
                      <Button
                        key={decision}
                        size="sm"
                        variant={decision === 'APPROVED' ? 'primary' : 'danger-outline'}
                        icon={<Icon size={16} />}
                        loading={busy === device.id}
                        disabled={busy !== null}
                        aria-label={t('devices.actionLabel', { action: label, name: device.name })}
                        onClick={() => void change(device, decision, decide)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PagedItems>
  );
}
