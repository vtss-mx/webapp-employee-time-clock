import { Ban, Check, MonitorSmartphone, ShieldOff, Smartphone, Tablet, X } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { DeviceStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { usePagedList } from '../../hooks/usePagedList';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { DeviceStatus, ValidatorDevice } from '../../types';
import { formatDateTime } from '../../utils/format';
import { describeDevice } from '../../utils/userAgent';

type Decision = Exclude<DeviceStatus, 'PENDING'>;

/** Qué hace cada decisión (botón, aviso y si se confirma antes). */
const DECISIONS: Record<Decision, { label: string; done: string; detail: string; confirm?: string }> = {
  APPROVED: { label: 'Autorizar', done: 'Dispositivo autorizado', detail: 'El validador ya puede iniciar sesión en este dispositivo.' },
  REJECTED: {
    label: 'Rechazar',
    done: 'Dispositivo rechazado',
    detail: 'El validador no podrá iniciar sesión en este dispositivo.',
    confirm: 'El validador no podrá iniciar sesión en este dispositivo. Puedes autorizarlo después si fue un error.',
  },
  REVOKED: {
    label: 'Revocar',
    done: 'Autorización revocada',
    detail: 'Sus sesiones abiertas se cerraron y ya no podrá iniciar sesión en este dispositivo.',
    confirm: 'Se cerrarán las sesiones abiertas del validador y ya no podrá iniciar sesión en este dispositivo hasta que lo autorices de nuevo.',
  },
};

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
  const feedback = useFeedback();
  const { data: validator } = useResource(() => validatorService.get(validatorId), validatorId, 'No se pudo cargar el validador');
  const [busy, setBusy] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ device: ValidatorDevice; decision: Decision } | null>(null);

  const list = usePagedList((page, signal) => validatorService.devices(validatorId, page, signal), {
    errorTitle: 'No se pudieron cargar los dispositivos',
    filterKey: String(validatorId),
  });

  const decide = async (device: ValidatorDevice, decision: Decision) => {
    setBusy(device.id);
    setConfirm(null);
    try {
      const saved = await validatorService.setDeviceStatus(validatorId, device.id, decision);
      list.updateItems((items) => items.map((d) => (d.id === saved.id ? saved : d)));
      void feedback.success(DECISIONS[decision].done, `${saved.name}: ${DECISIONS[decision].detail}`);
    } catch (err) {
      void feedback.fromError(err, { title: 'No se pudo actualizar el dispositivo' });
    } finally {
      setBusy(null);
    }
  };

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
                    {AVAILABLE[device.status].map((decision) => (
                      <Button
                        key={decision}
                        size="sm"
                        variant={decision === 'APPROVED' ? 'primary' : 'danger-outline'}
                        icon={decision === 'APPROVED' ? <Check size={16} /> : decision === 'REJECTED' ? <X size={16} /> : <ShieldOff size={16} />}
                        loading={busy === device.id}
                        disabled={busy !== null}
                        aria-label={`${DECISIONS[decision].label} ${device.name}`}
                        onClick={() => (DECISIONS[decision].confirm ? setConfirm({ device, decision }) : void decide(device, decision))}
                      >
                        {DECISIONS[decision].label}
                      </Button>
                    ))}
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
      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `${DECISIONS[confirm.decision].label} «${confirm.device.name}»` : ''}
        message={confirm ? (DECISIONS[confirm.decision].confirm ?? '') : ''}
        confirmLabel={confirm ? DECISIONS[confirm.decision].label : ''}
        tone="danger"
        loading={busy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && void decide(confirm.device, confirm.decision)}
      />
    </div>
  );
}
