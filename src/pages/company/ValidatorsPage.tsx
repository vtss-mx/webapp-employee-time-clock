import { KeyRound, MapPin, MonitorSmartphone, Pencil, Power, PowerOff, Radar, ScanLine, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidatorModeBadge } from '../../components/ValidatorModes';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { addressLine } from '../../utils/address';
import { formatDateTime, initials } from '../../utils/format';

/** Qué validador se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${'status' | 'delete'}:${number}`;

const today = (count: number) => (count === 1 ? '1 identificación hoy' : `${count} identificaciones hoy`);

/** Activar o desactivar: qué cambia para quien usa el validador (el estado, "antes → después"). */
function statusConfirm(validator: Validator): ConfirmInput {
  const state = { label: 'Estado', before: validator.active ? 'Activo' : 'Inactivo', after: validator.active ? 'Inactivo' : 'Activo' };
  const account = [{ label: 'Correo de acceso', value: validator.email }];
  return validator.active
    ? {
        tone: 'danger',
        icon: <PowerOff size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Desactivar el validador ${validator.name}?`,
        message: 'Dejará de identificar empleados y su sesión se cerrará de inmediato. No podrá iniciar sesión hasta que lo actives.',
        changes: [state],
        details: account,
        confirmLabel: 'Desactivar',
        confirmIcon: <PowerOff size={18} />,
      }
    : {
        tone: 'success',
        icon: <Power size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Activar el validador ${validator.name}?`,
        message: 'Podrá iniciar sesión de nuevo e identificar a tu personal desde sus dispositivos autorizados.',
        changes: [state],
        details: account,
        confirmLabel: 'Activar',
        confirmIcon: <Power size={18} />,
      };
}

/** Eliminar: su cuenta desaparece, la bitácora de sus identificaciones se conserva. */
function deleteConfirm(validator: Validator, modeName: string): ConfirmInput {
  return {
    kind: 'delete',
    title: `¿Eliminar el validador ${validator.name}?`,
    message: 'Se eliminará su cuenta y sus dispositivos ya no podrán iniciar sesión. La bitácora de sus identificaciones se conserva.',
    details: [
      { label: 'Correo de acceso', value: validator.email },
      { label: 'Modo', value: modeName },
      { label: 'Domicilio', value: addressLine(validator.address) || 'Sin domicilio' },
    ],
    note: 'Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar validador',
  };
}

/**
 * Validadores de identidad de la empresa: cuentas para tabletas o teléfonos en los accesos que
 * identifican a los empleados por QR, por rostro o por ambos.
 */
export function ValidatorsPage() {
  const { policy } = useVerificationPolicy();
  const list = usePagedList((page, signal) => validatorService.list(page, signal), { errorTitle: 'No se pudieron cargar los validadores' });
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction<Busy>();

  const replace = (saved: Validator) => list.updateItems((current) => current.map((v) => (v.id === saved.id ? saved : v)));

  // Activar, desactivar y eliminar preguntan antes (cancelar no envía nada).
  const toggle = (validator: Validator) => {
    const active = !validator.active;
    return run(() => validatorService.setStatus(validator.id, active), {
      busy: `status:${validator.id}`,
      confirm: statusConfirm(validator),
      errorTitle: 'No se pudo cambiar el estado',
      success: [active ? 'Validador activado' : 'Validador desactivado', active ? `${validator.name} ya puede iniciar sesión.` : 'Su sesión se cerró y no podrá iniciar sesión hasta que lo actives.'],
      onSuccess: replace,
    });
  };

  const remove = (validator: Validator) =>
    run(() => validatorService.remove(validator.id), {
      busy: `delete:${validator.id}`,
      confirm: deleteConfirm(validator, nameOf('validator_modes', validator.mode)),
      errorTitle: 'No se pudo eliminar el validador',
      success: ['Validador eliminado', 'Su cuenta se eliminó; la bitácora de sus identificaciones se conserva.'],
      onSuccess: list.retry,
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
                      loading={busy === `status:${validator.id}`}
                      disabled={busy !== null}
                      onClick={() => void toggle(validator)}
                    >
                      {validator.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={<Trash2 size={16} />}
                      title="Eliminar"
                      aria-label={`Eliminar ${validator.name}`}
                      loading={busy === `delete:${validator.id}`}
                      disabled={busy !== null}
                      onClick={() => void remove(validator)}
                    />
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
    </div>
  );
}
