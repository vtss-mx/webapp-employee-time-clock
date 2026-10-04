import { KeyRound, MapPin, MonitorSmartphone, Pencil, Power, PowerOff, Radar, ScanLine, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidatorModeBadge } from '../../components/ValidatorModes';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useAction } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import { addressLine } from '../../utils/address';
import { formatDateTime, initials } from '../../utils/format';

type Confirm = { kind: 'deactivate' | 'delete'; validator: Validator } | null;

const today = (count: number) => (count === 1 ? '1 identificación hoy' : `${count} identificaciones hoy`);

/**
 * Validadores de identidad de la empresa: cuentas para tabletas o teléfonos en los accesos que
 * identifican a los empleados por QR, por rostro o por ambos.
 */
export function ValidatorsPage() {
  const { policy } = useVerificationPolicy();
  const list = usePagedList((page, signal) => validatorService.list(page, signal), { errorTitle: 'No se pudieron cargar los validadores' });
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { busy, run } = useAction<number>();
  const close = () => setConfirm(null);

  const replace = (saved: Validator) => list.updateItems((current) => current.map((v) => (v.id === saved.id ? saved : v)));

  const setActive = (validator: Validator, active: boolean) =>
    run(() => validatorService.setStatus(validator.id, active), {
      busy: validator.id,
      errorTitle: 'No se pudo cambiar el estado',
      success: [active ? 'Validador activado' : 'Validador desactivado', active ? `${validator.name} ya puede iniciar sesión.` : 'Su sesión se cerró y no podrá iniciar sesión hasta que lo actives.'],
      onSuccess: replace,
      onSettled: close,
    });

  const remove = (validator: Validator) =>
    run(() => validatorService.remove(validator.id), {
      busy: validator.id,
      errorTitle: 'No se pudo eliminar el validador',
      success: ['Validador eliminado', 'Su cuenta se eliminó; la bitácora de sus identificaciones se conserva.'],
      onSuccess: list.retry,
      onSettled: close,
    });

  const addButton = (
    <ButtonLink to={paths.company.newValidator} variant="primary" icon={<ScanLine size={18} />}>
      Agregar validador
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Validadores de identidad"
          subtitle={list.data ? `${list.total} ${list.total === 1 ? 'registrado' : 'registrados'} · identifican a tu personal por QR, rostro o ambos` : 'Cargando...'}
          actions={addButton}
        />
        <PanelSection>
          <PagedItems
            list={list}
            empty={{
              icon: <ScanLine />,
              title: 'No hay validadores registrados',
              description: 'Crea una cuenta para la tableta o el teléfono de cada acceso (recepción, comedor, planta…) que identificará a tu personal.',
              action: addButton,
            }}
            pager={{ noun: { one: 'validador', other: 'validadores' } }}
          >
            {(items) => (
            <ul className={`validator-list stagger ${list.loading ? 'is-loading' : ''}`}>
              {items.map((validator) => (
                <li key={validator.id}>
                  <span className="avatar">{initials(validator.name)}</span>
                  <span className="validator-list__info">
                    <strong className="truncate">{validator.name}</strong>
                    <small className="muted truncate">{validator.email}</small>
                    <small className="muted">
                      {today(validator.identifications_today)} · {validator.last_login_at ? `Último acceso: ${formatDateTime(validator.last_login_at)}` : 'Aún no inicia sesión'}
                    </small>
                    <small className={`validator-list__address ${validator.address ? 'muted' : 'text-warning'}`}>
                      <MapPin size={13} aria-hidden />
                      <span className="truncate">{validator.address ? addressLine(validator.address) : 'Sin domicilio: edítalo para agregarlo'}</span>
                    </small>
                  </span>
                  <span className="validator-list__badges">
                    <ValidatorModeBadge mode={validator.mode} />
                    {validator.devices_pending > 0 && (
                      <span className="badge badge--warning badge--live">
                        {validator.devices_pending === 1 ? '1 dispositivo por autorizar' : `${validator.devices_pending} dispositivos por autorizar`}
                      </span>
                    )}
                    {validator.location_required && validator.location_radius_m && (
                      <span className="badge badge--warning badge--plain" title="Solo inicia sesión dentro de este radio del punto del domicilio">
                        <Radar size={14} aria-hidden /> {validator.location_radius_m.toLocaleString('es-MX')} m
                      </span>
                    )}
                    <StatusBadge active={validator.active} />
                  </span>
                  <span className="validator-list__actions">
                    <ButtonLink
                      to={paths.company.validatorDevices(validator.id)}
                      size="sm"
                      variant={validator.devices_pending > 0 ? 'secondary' : 'ghost'}
                      iconOnly
                      icon={<MonitorSmartphone size={16} />}
                      title="Dispositivos"
                      aria-label={`Dispositivos de ${validator.name}`}
                    />
                    <Button size="sm" variant="ghost" iconOnly icon={<Pencil size={16} />} title="Editar" aria-label={`Editar ${validator.name}`} onClick={() => void navigate(paths.company.editValidator(validator.id))} />
                    <Button size="sm" variant="ghost" iconOnly icon={<KeyRound size={16} />} title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${validator.name}`} onClick={() => void navigate(paths.company.validatorPassword(validator.id))} />
                    <Button
                      size="sm"
                      variant={validator.active ? 'ghost' : 'secondary'}
                      icon={validator.active ? <PowerOff size={16} /> : <Power size={16} />}
                      loading={busy === validator.id && !confirm}
                      disabled={busy !== null}
                      onClick={() => (validator.active ? setConfirm({ kind: 'deactivate', validator }) : void setActive(validator, true))}
                    >
                      {validator.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={16} />} title="Eliminar" aria-label={`Eliminar ${validator.name}`} disabled={busy !== null} onClick={() => setConfirm({ kind: 'delete', validator })} />
                  </span>
                </li>
              ))}
            </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            {policy.validator_mobile_only ? <Smartphone size={16} /> : <ShieldCheck size={16} color="var(--success)" />}
            {policy.validator_mobile_only
              ? 'Los validadores solo inician sesión desde una tableta o un teléfono (Configuración).'
              : 'Cada identificación queda registrada en la bitácora con el validador que la hizo.'}
          </p>
        </PanelFooter>
      </Panel>

      <ConfirmDialog
        open={confirm?.kind === 'deactivate'}
        title="Desactivar validador"
        message={confirm ? `${confirm.validator.name} dejará de identificar empleados y su sesión se cerrará de inmediato.` : ''}
        confirmLabel="Desactivar"
        tone="danger"
        loading={busy !== null}
        onCancel={close}
        onConfirm={() => confirm && void setActive(confirm.validator, false)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Eliminar validador"
        message={confirm ? `Se eliminará la cuenta de ${confirm.validator.name} (${confirm.validator.email}). La bitácora de sus identificaciones se conserva.` : ''}
        confirmLabel="Eliminar"
        tone="danger"
        loading={busy !== null}
        onCancel={close}
        onConfirm={() => confirm && void remove(confirm.validator)}
      />
    </div>
  );
}
