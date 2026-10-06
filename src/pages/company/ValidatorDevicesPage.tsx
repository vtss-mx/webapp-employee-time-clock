import { Ban, Check, MonitorSmartphone, ShieldOff, Smartphone, Tablet, X, type LucideIcon } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DeviceStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { DeviceStatus, ValidatorDevice } from '../../types';
import type { ConfirmInput, ConfirmTone } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';
import { describeDevice } from '../../utils/userAgent';

type Decision = Exclude<DeviceStatus, 'PENDING'>;

/**
 * Qué hace cada decisión: color e ícono de su botón y de su confirmación; sus textos (botón, qué
 * implica y aviso al terminar) están en `validators.devices.decisions.<texts>`.
 */
const DECISIONS: Record<Decision, { texts: 'approved' | 'rejected' | 'revoked'; tone: ConfirmTone; Icon: LucideIcon }> = {
  APPROVED: { texts: 'approved', tone: 'success', Icon: Check },
  REJECTED: { texts: 'rejected', tone: 'danger', Icon: X },
  REVOKED: { texts: 'revoked', tone: 'danger', Icon: ShieldOff },
};

/** Etiqueta del botón de una decisión ("Autorizar"), en el idioma activo. */
const decisionLabel = (decision: Decision) => t(`validators.devices.decisions.${DECISIONS[decision].texts}.label`);

/** Toda decisión se confirma: el equipo, su estado "antes → después" (nombres del catálogo) y qué implica. */
function decisionConfirm(device: ValidatorDevice, decision: Decision, statusName: (status: DeviceStatus) => string): ConfirmInput {
  const { texts, tone, Icon } = DECISIONS[decision];
  return {
    tone,
    icon: <Icon size={30} />,
    eyebrow: t('validators.devices.eyebrow'),
    title: t(`validators.devices.decisions.${texts}.title`, { name: device.name }),
    message: t(`validators.devices.decisions.${texts}.message`),
    changes: [{ label: t('common.fields.status'), before: statusName(device.status), after: statusName(decision) }],
    details: [
      { label: t('validators.devices.equipment'), value: describeDevice(device.user_agent).label },
      { label: t('validators.devices.registeredLabel'), value: formatDateTime(device.created_at) },
    ],
    confirmLabel: decisionLabel(decision),
    confirmIcon: <Icon size={18} />,
  };
}

/** El aviso al terminar (se arma al dibujarse: sigue al idioma activo). */
const decided = (saved: ValidatorDevice, decision: Decision): SuccessNotice => {
  const { texts } = DECISIONS[decision];
  return [t(`validators.devices.decisions.${texts}.done`), t('validators.devices.doneText', { name: saved.name, detail: t(`validators.devices.decisions.${texts}.detail`) })];
};

/** Fechas e IP del dispositivo en una línea ("Registrado … · Último acceso … · IP …"). */
function deviceFacts(device: ValidatorDevice): string {
  return [
    t('validators.devices.registered', { date: formatDateTime(device.created_at) }),
    device.last_seen_at && t('validators.devices.lastSeen', { date: formatDateTime(device.last_seen_at) }),
    device.last_ip && t('validators.devices.ip', { ip: device.last_ip }),
  ]
    .filter(Boolean)
    .join(' · ');
}

const loadError = () => t('validators.loadError');
const devicesError = () => t('validators.devices.loadError');
const decisionError = () => t('validators.devices.error');

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
  const t = useT();
  const validatorId = Number(useParams().id);
  const { data: validator } = useResource((signal) => validatorService.get(validatorId, signal), validatorId, loadError);
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction<number>();

  const list = usePagedList((page, signal) => validatorService.devices(validatorId, page, signal), {
    errorTitle: devicesError,
    filterKey: String(validatorId),
  });

  // Cancelar la confirmación no envía nada y el dispositivo sigue como estaba.
  const decide = (device: ValidatorDevice, decision: Decision) =>
    run(() => validatorService.setDeviceStatus(validatorId, device.id, decision), {
      busy: device.id,
      confirm: () => decisionConfirm(device, decision, (status) => nameOf('device_statuses', status)),
      errorTitle: decisionError,
      success: (saved) => decided(saved, decision),
      onSuccess: (saved) => list.updateItems((items) => items.map((d) => (d.id === saved.id ? saved : d))),
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('validators.devices.title')}
          subtitle={validator ? `${validator.name} · ${validator.email}` : t('common.states.loading')}
          backTo={paths.company.validators}
          backLabel={t('validators.back')}
        />
        <PanelSection>
          <p className="muted small">{t('validators.devices.intro')}</p>
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <MonitorSmartphone />,
              title: t('validators.devices.empty.title'),
              description: t('validators.devices.empty.description'),
            }}
            pager={{ noun: { one: t('validators.devices.noun.one'), other: t('validators.devices.noun.other') } }}
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
                    <small className="muted truncate">{deviceFacts(device)}</small>
                    {device.reviewed_by && (
                      <small className="muted truncate">
                        {t('validators.devices.reviewedBy', { name: device.reviewed_by })}
                        {device.reviewed_at && ` · ${formatDateTime(device.reviewed_at)}`}
                      </small>
                    )}
                  </span>
                  <span className="validator-list__badges">
                    <DeviceStatusBadge status={device.status} />
                  </span>
                  <span className="validator-list__actions">
                    {AVAILABLE[device.status].map((decision) => {
                      const { Icon } = DECISIONS[decision];
                      const label = decisionLabel(decision);
                      return (
                        <Button
                          key={decision}
                          size="sm"
                          variant={decision === 'APPROVED' ? 'primary' : 'danger-outline'}
                          icon={<Icon size={16} />}
                          loading={busy === device.id}
                          disabled={busy !== null}
                          aria-label={t('validators.devices.actionLabel', { action: label, name: device.name })}
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
            <Ban size={16} /> {t('validators.devices.footer')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
