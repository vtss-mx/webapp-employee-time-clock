import { Ban, Check, MonitorSmartphone, ShieldOff, Smartphone, Tablet, X, type LucideIcon } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DeviceStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { usePagedList } from '../../hooks/usePagedList';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { DeviceStatus, ValidatorDevice } from '../../types';
import type { ConfirmInput, ConfirmTone } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';
import { describeDevice } from '../../utils/userAgent';

type Decision = Exclude<DeviceStatus, 'PENDING'>;

/** Qué hace cada decisión: botón, confirmación (qué implica, color e ícono) y aviso al terminar. */
const DECISIONS: Record<Decision, { label: string; done: string; detail: string; message: string; tone: ConfirmTone; Icon: LucideIcon }> = {
  APPROVED: {
    label: 'Autorizar',
    done: 'Dispositivo autorizado',
    detail: 'El validador ya puede iniciar sesión en este dispositivo.',
    message: 'El validador podrá iniciar sesión e identificar a tu personal en este dispositivo. Puedes revocarlo después.',
    tone: 'success',
    Icon: Check,
  },
  REJECTED: {
    label: 'Rechazar',
    done: 'Dispositivo rechazado',
    detail: 'El validador no podrá iniciar sesión en este dispositivo.',
    message: 'El validador no podrá iniciar sesión en este dispositivo. Puedes autorizarlo después si fue un error.',
    tone: 'danger',
    Icon: X,
  },
  REVOKED: {
    label: 'Revocar',
    done: 'Autorización revocada',
    detail: 'Sus sesiones abiertas se cerraron y ya no podrá iniciar sesión en este dispositivo.',
    message: 'Se cerrarán las sesiones abiertas del validador y ya no podrá iniciar sesión en este dispositivo hasta que lo autorices de nuevo.',
    tone: 'danger',
    Icon: ShieldOff,
  },
};

/** Toda decisión se confirma: el equipo, su estado "antes → después" (nombres del catálogo) y qué implica. */
function decisionConfirm(device: ValidatorDevice, decision: Decision, statusName: (status: DeviceStatus) => string): ConfirmInput {
  const { label, message, tone, Icon } = DECISIONS[decision];
  return {
    tone,
    icon: <Icon size={30} />,
    eyebrow: 'Dispositivo del validador',
    title: `¿${label} «${device.name}»?`,
    message,
    changes: [{ label: 'Estado', before: statusName(device.status), after: statusName(decision) }],
    details: [
      { label: 'Equipo', value: describeDevice(device.user_agent).label },
      { label: 'Registrado', value: formatDateTime(device.created_at) },
    ],
    confirmLabel: label,
    confirmIcon: <Icon size={18} />,
  };
}

/** Decisiones disponibles según el estado del dispositivo (las mismas reglas que el backend). */
const AVAILABLE: Record<DeviceStatus, Decision[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['REVOKED'],
  REJECTED: ['APPROVED'],
  REVOKED: ['APPROVED'],
};

function DeviceIcon({ device }: { device: ValidatorDevice }) {
  const ua = device.user_agent ?? '';
  if (/iPad|Tablet/i.test(ua)) return <Tablet size={20} />;
  return describeDevice(device.user_agent).mobile ? <Smartphone size={20} /> : <MonitorSmartphone size={20} />;
}

/**
 * Dispositivos de un validador: cada tableta o teléfono en que inició sesión queda por autorizar;
 * la empresa lo autoriza, lo rechaza o le retira la autorización (cierra sus sesiones).
 */
export function ValidatorDevicesPage() {
  const validatorId = Number(useParams().id);
  const { data: validator } = useResource((signal) => validatorService.get(validatorId, signal), validatorId, 'No se pudo cargar el validador');
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction<number>();

  const list = usePagedList((page, signal) => validatorService.devices(validatorId, page, signal), {
    errorTitle: 'No se pudieron cargar los dispositivos',
    filterKey: String(validatorId),
  });

  // Cancelar la confirmación no envía nada y el dispositivo sigue como estaba.
  const decide = (device: ValidatorDevice, decision: Decision) =>
    run(() => validatorService.setDeviceStatus(validatorId, device.id, decision), {
      busy: device.id,
      confirm: decisionConfirm(device, decision, (status) => nameOf('device_statuses', status)),
      errorTitle: 'No se pudo actualizar el dispositivo',
      success: (saved) => [DECISIONS[decision].done, `${saved.name}: ${DECISIONS[decision].detail}`],
      onSuccess: (saved) => list.updateItems((items) => items.map((d) => (d.id === saved.id ? saved : d))),
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Dispositivos"
          subtitle={validator ? `${validator.name} · ${validator.email}` : 'Cargando...'}
          backTo={paths.company.validators}
          backLabel="Validadores"
        />
        <PanelSection>
          <p className="muted small">
            Cada tableta o teléfono en que el validador inicia sesión queda registrado con una llave propia (no se puede copiar a otro
            equipo) y solo opera cuando lo autorizas.
          </p>
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <MonitorSmartphone />,
              title: 'No hay dispositivos registrados',
              description: 'Cuando el validador inicie sesión en una tableta o un teléfono, el dispositivo aparecerá aquí para que lo autorices.',
            }}
            pager={{ noun: { one: 'dispositivo', other: 'dispositivos' } }}
          >
            {(items) => (
            <ul className={`validator-list stagger ${list.loading ? 'is-loading' : ''}`}>
              {items.map((device) => (
                <li key={device.id}>
                  <span className="icon-tile">
                    <DeviceIcon device={device} />
                  </span>
                  <span className="validator-list__info">
                    <strong className="truncate">{device.name}</strong>
                    <small className="muted truncate">
                      Registrado {formatDateTime(device.created_at)}
                      {device.last_seen_at && ` · Último acceso ${formatDateTime(device.last_seen_at)}`}
                      {device.last_ip && ` · IP ${device.last_ip}`}
                    </small>
                    {device.reviewed_by && (
                      <small className="muted truncate">
                        Revisado por {device.reviewed_by}
                        {device.reviewed_at && ` · ${formatDateTime(device.reviewed_at)}`}
                      </small>
                    )}
                  </span>
                  <span className="validator-list__badges">
                    <DeviceStatusBadge status={device.status} />
                  </span>
                  <span className="validator-list__actions">
                    {AVAILABLE[device.status].map((decision) => {
                      const { label, Icon } = DECISIONS[decision];
                      return (
                        <Button
                          key={decision}
                          size="sm"
                          variant={decision === 'APPROVED' ? 'primary' : 'danger-outline'}
                          icon={<Icon size={16} />}
                          loading={busy === device.id}
                          disabled={busy !== null}
                          aria-label={`${label} ${device.name}`}
                          onClick={() => void decide(device, decision)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <Ban size={16} /> Retirar la autorización cierra de inmediato las sesiones abiertas del validador.
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
