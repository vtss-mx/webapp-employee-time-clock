import { KeyRound, MapPin, MonitorSmartphone, Pencil, Power, PowerOff, Radar, ScanLine, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidatorModeBadge } from '../../components/ValidatorModes';
import { deleteNote, listEmpty, listSubtitle } from '../../components/trash/TrashParts';
import { useRestore } from '../../components/trash/useRestore';
import { ListToolbar } from '../../components/ui/ListControls';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useSearchList } from '../../hooks/useSearchList';
import { radiusText } from '../../hooks/useValidatorForm';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { addressLine } from '../../utils/address';
import { formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { Avatar } from '../../components/ui/Avatar';
import { DeletedValidatorItem, validatorRestore } from './ValidatorTrash';

/** Qué validador se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${'status' | 'delete'}:${number}`;

/** Activar o desactivar: qué cambia para quien usa el validador (el estado, "antes → después"). */
function statusConfirm(validator: Validator): ConfirmInput {
  const active = t('common.states.active');
  const inactive = t('common.states.inactive');
  const state = { label: t('common.fields.status'), before: validator.active ? active : inactive, after: validator.active ? inactive : active };
  const account = [{ label: t('validators.accessEmail'), value: validator.email }];
  return validator.active
    ? {
        tone: 'danger',
        icon: <PowerOff size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('validators.status.deactivateTitle', { name: validator.name }),
        message: t('validators.status.deactivateMessage'),
        changes: [state],
        details: account,
        confirmLabel: t('common.actions.deactivate'),
        confirmIcon: <PowerOff size={18} />,
      }
    : {
        tone: 'success',
        icon: <Power size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('validators.status.activateTitle', { name: validator.name }),
        message: t('validators.status.activateMessage'),
        changes: [state],
        details: account,
        confirmLabel: t('common.actions.activate'),
        confirmIcon: <Power size={18} />,
      };
}

/** Eliminar: va a «Eliminados» (se restaura durante 1 año); la bitácora de sus identificaciones se conserva. */
function deleteConfirm(validator: Validator, modeName: string): ConfirmInput {
  return {
    kind: 'delete',
    title: t('validators.delete.title', { name: validator.name }),
    message: t('validators.delete.message'),
    details: [
      { label: t('validators.accessEmail'), value: validator.email },
      { label: t('validators.delete.mode'), value: modeName },
      { label: t('validators.form.summary.address'), value: addressLine(validator.address) || t('validators.delete.noAddress') },
    ],
    note: deleteNote({ person: true }),
    confirmLabel: t('validators.delete.confirm'),
  };
}

const loadError = () => t('validators.list.loadError');
const statusError = () => t('validators.status.error');
const deleteError = () => t('validators.delete.error');
/** Avisos al terminar: se arman al dibujarse (siguen al idioma activo). */
const statusChanged = (validator: Validator, active: boolean): SuccessNotice =>
  active ? [t('validators.status.activated'), t('validators.status.activatedText', { name: validator.name })] : [t('validators.status.deactivated'), t('validators.status.deactivatedText')];
const deleted = (): SuccessNotice => [t('validators.delete.done'), t('validators.delete.doneText')];

/**
 * Uso del límite de validadores activos que fija el administrador de la plataforma ("2 de 3 activos") con su barra y,
 * al llegar al límite, qué hacer (agregar o activar otro queda deshabilitado).
 */
function ValidatorSeats({ active, limit }: { active: number; limit: number }) {
  const t = useT();
  const percent = Math.min(100, Math.round((active / limit) * 100));
  return (
    <div className="validator-seats">
      <p className="validator-seats__numbers">
        <strong>{t('validators.list.usage', { active: formatCount(active), count: limit })}</strong>
      </p>
      <div className={`usage__bar ${active >= limit ? 'is-high' : ''}`} role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('validators.list.usageLabel')}>
        <span style={{ width: `${percent}%` }} />
      </div>
      {active >= limit && <p className="small muted">{t('validators.list.limitReached')}</p>}
    </div>
  );
}

/**
 * Validadores de identidad de la empresa: cuentas para tabletas o teléfonos en los accesos que
 * identifican a los empleados por QR, por rostro o por ambos. Cuántos pueden estar activos lo decide el
 * administrador de la plataforma (el backend responde 409 si no queda lugar; aquí solo se adelanta).
 */
export function ValidatorsPage() {
  const t = useT();
  const { policy } = useVerificationPolicy();
  // Sin búsqueda en el backend: solo «Todos» o «Eliminados».
  const list = useSearchList((query, signal) => validatorService.list({ page: query.page, size: query.size, deleted: query.deleted }, signal), { errorTitle: loadError });
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction<Busy>();
  const { restoring, restore } = useRestore();
  const restoreValidator = (validator: Validator) =>
    void restore(validator.id, () => validatorService.restore(validator.id), () => validatorRestore(validator, nameOf('validator_modes', validator.mode)), list.retry);

  const replace = (saved: Validator) => list.updateItems((current) => current.map((v) => (v.id === saved.id ? saved : v)));

  // Activar, desactivar y eliminar preguntan antes (cancelar no envía nada).
  const toggle = (validator: Validator) => {
    const active = !validator.active;
    return run(() => validatorService.setStatus(validator.id, active), {
      busy: `status:${validator.id}`,
      confirm: () => statusConfirm(validator),
      errorTitle: statusError,
      success: () => statusChanged(validator, active),
      // Se ve al instante y la lista se vuelve a pedir: el uso del límite ("N de M") es del servidor.
      onSuccess: (saved) => {
        replace(saved);
        list.retry();
      },
    });
  };

  const remove = (validator: Validator) =>
    run(() => validatorService.remove(validator.id), {
      busy: `delete:${validator.id}`,
      confirm: () => deleteConfirm(validator, nameOf('validator_modes', validator.mode)),
      errorTitle: deleteError,
      success: deleted,
      onSuccess: list.retry,
    });

  // Sin lugares en el límite: agregar (y activar uno inactivo) se deshabilita con la ayuda de qué hacer.
  const full = list.data !== null && list.data.active >= list.data.limit;
  const addButton = full ? (
    <Button variant="primary" icon={<ScanLine size={18} />} disabled title={t('validators.list.limitReached')}>
      {t('validators.list.add')}
    </Button>
  ) : (
    <ButtonLink to={paths.company.newValidator} variant="primary" icon={<ScanLine size={18} />}>
      {t('validators.list.add')}
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('validators.list.title')}
          subtitle={listSubtitle(list, (count) => t('validators.list.subtitle', { count }))}
          actions={addButton}
        />
        <PanelSection>
          {list.data && <ValidatorSeats active={list.data.active} limit={list.data.limit} />}
          <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
          <PagedItems
            list={list}
            empty={listEmpty(list, { empty: { icon: <ScanLine />, title: t('validators.list.empty.title'), description: t('validators.list.empty.description'), action: addButton } })}
            pager={{ noun: { one: t('validators.noun.one'), other: t('validators.noun.other') } }}
          >
            {(items) => (
            <ul className={`validator-list stagger ${list.loading ? 'is-loading' : ''}`}>
              {items.map((validator) =>
                list.trash ? (
                  <DeletedValidatorItem key={validator.id} validator={validator} busy={restoring === validator.id} disabled={restoring !== null} onRestore={() => restoreValidator(validator)} />
                ) : (
                  <li key={validator.id}>
                    <Avatar name={validator.name} src={validator.avatar} decorative />
                    <span className="validator-list__info">
                      <strong className="truncate">{validator.name}</strong>
                      <small className="muted truncate">{validator.email}</small>
                      <small className="muted">
                        {t('validators.list.today', { count: validator.identifications_today })} ·{' '}
                        {validator.last_login_at ? t('validators.list.lastLogin', { date: formatDateTime(validator.last_login_at) }) : t('validators.list.neverLoggedIn')}
                      </small>
                      <small className={`validator-list__address ${validator.address ? 'muted' : 'text-warning'}`}>
                        <MapPin size={13} aria-hidden />
                        <span className="truncate">{validator.address ? addressLine(validator.address) : t('validators.list.noAddress')}</span>
                      </small>
                    </span>
                    <span className="validator-list__badges">
                      <ValidatorModeBadge mode={validator.mode} />
                      {validator.devices_pending > 0 && (
                        <span className="badge badge--warning badge--live">
                          {t('validators.list.pendingDevices', { count: validator.devices_pending })}
                        </span>
                      )}
                      {validator.location_required && validator.location_radius_m && (
                        <span className="badge badge--warning badge--plain" title={t('validators.list.radiusHint')}>
                          <Radar size={14} aria-hidden /> {radiusText(validator.location_radius_m)}
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
                        title={t('validators.devices.title')}
                        aria-label={t('validators.list.devicesOf', { name: validator.name })}
                      />
                      <Button size="sm" variant="ghost" iconOnly icon={<Pencil size={16} />} title={t('common.actions.edit')} aria-label={t('validators.list.editOf', { name: validator.name })} onClick={() => void navigate(paths.company.editValidator(validator.id))} />
                      <Button size="sm" variant="ghost" iconOnly icon={<KeyRound size={16} />} title={t('validators.password.title')} aria-label={t('validators.list.resetPasswordOf', { name: validator.name })} onClick={() => void navigate(paths.company.validatorPassword(validator.id))} />
                      <Button
                        size="sm"
                        variant={validator.active ? 'ghost' : 'secondary'}
                        icon={validator.active ? <PowerOff size={16} /> : <Power size={16} />}
                        loading={busy === `status:${validator.id}`}
                        disabled={busy !== null || (full && !validator.active)}
                        title={full && !validator.active ? t('validators.list.limitReached') : undefined}
                        onClick={() => void toggle(validator)}
                      >
                        {t(validator.active ? 'common.actions.deactivate' : 'common.actions.activate')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon={<Trash2 size={16} />}
                        title={t('common.actions.delete')}
                        aria-label={t('validators.list.deleteOf', { name: validator.name })}
                        loading={busy === `delete:${validator.id}`}
                        disabled={busy !== null}
                        onClick={() => void remove(validator)}
                      />
                    </span>
                  </li>
                ),
              )}
            </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            {policy.validator_mobile_only ? <Smartphone size={16} /> : <ShieldCheck size={16} color="var(--success)" />}
            {t(policy.validator_mobile_only ? 'validators.list.mobileOnly' : 'validators.list.logged')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
