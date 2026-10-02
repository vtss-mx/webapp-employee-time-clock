import { KeyRound, Pencil, Power, PowerOff, ScanLine, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { ValidatorModal, type ValidatorDialog } from '../../components/ValidatorModal';
import { ValidatorModeBadge } from '../../components/ValidatorModes';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { validatorService } from '../../services/validatorService';
import type { Validator } from '../../types';
import { formatDateTime, initials } from '../../utils/format';

type Confirm = { kind: 'deactivate' | 'delete'; validator: Validator } | null;

const today = (count: number) => (count === 1 ? '1 identificación hoy' : `${count} identificaciones hoy`);

/**
 * Validadores de identidad de la empresa: cuentas para tabletas o teléfonos en los accesos que
 * identifican a los empleados por QR, por rostro o por ambos.
 */
export function ValidatorsPage() {
  const feedback = useFeedback();
  const { policy } = useVerificationPolicy();
  const [items, setItems] = useState<Validator[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dialog, setDialog] = useState<ValidatorDialog | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setError(null);
    validatorService.list().then(setItems).catch(setError);
  }, []);
  useEffect(load, [load]);
  useErrorPopup(error, { title: 'No se pudieron cargar los validadores', retry: load });

  const replace = (saved: Validator) =>
    setItems((list) => (list?.some((v) => v.id === saved.id) ? list.map((v) => (v.id === saved.id ? saved : v)) : [...(list ?? []), saved]));

  const setActive = async (validator: Validator, active: boolean) => {
    setBusy(validator.id);
    try {
      replace(await validatorService.setStatus(validator.id, active));
      feedback.success(active ? 'Validador activado' : 'Validador desactivado', active ? `${validator.name} ya puede iniciar sesión.` : 'Su sesión se cerró y no podrá iniciar sesión hasta que lo actives.');
    } catch (err) {
      void feedback.fromError(err, { title: 'No se pudo cambiar el estado' });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const remove = async (validator: Validator) => {
    setBusy(validator.id);
    try {
      await validatorService.remove(validator.id);
      setItems((list) => list?.filter((v) => v.id !== validator.id) ?? null);
      feedback.success('Validador eliminado', 'Su cuenta se eliminó; la bitácora de sus identificaciones se conserva.');
    } catch (err) {
      void feedback.fromError(err, { title: 'No se pudo eliminar el validador' });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const addButton = (
    <Button variant="primary" icon={<ScanLine size={18} />} onClick={() => setDialog({ kind: 'create' })}>
      Agregar validador
    </Button>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Validadores de identidad"
          subtitle={items ? `${items.length} ${items.length === 1 ? 'registrado' : 'registrados'} · identifican a tu personal por QR, rostro o ambos` : 'Cargando...'}
          actions={addButton}
        />
        <PanelSection>
          {!items && (error ? <RetryState onRetry={load} /> : <SkeletonRows />)}
          {items?.length === 0 && (
            <div className="empty">
              <span className="icon-tile icon-tile--lg">
                <ScanLine size={30} />
              </span>
              <h2>Aún no tienes validadores</h2>
              <p className="muted">Crea una cuenta para la tableta o el teléfono de cada acceso: recepción, comedor, planta...</p>
              {addButton}
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="validator-list stagger">
              {items.map((validator) => (
                <li key={validator.id}>
                  <span className="avatar">{initials(validator.name)}</span>
                  <span className="validator-list__info">
                    <strong className="truncate">{validator.name}</strong>
                    <small className="muted truncate">{validator.email}</small>
                    <small className="muted">
                      {today(validator.identifications_today)} · {validator.last_login_at ? `Último acceso: ${formatDateTime(validator.last_login_at)}` : 'Aún no inicia sesión'}
                    </small>
                  </span>
                  <span className="validator-list__badges">
                    <ValidatorModeBadge mode={validator.mode} />
                    <StatusBadge active={validator.active} />
                  </span>
                  <span className="validator-list__actions">
                    <Button size="sm" variant="ghost" iconOnly icon={<Pencil size={16} />} title="Editar" aria-label={`Editar ${validator.name}`} onClick={() => setDialog({ kind: 'edit', validator })} />
                    <Button size="sm" variant="ghost" iconOnly icon={<KeyRound size={16} />} title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${validator.name}`} onClick={() => setDialog({ kind: 'password', validator })} />
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

      {dialog && <ValidatorModal key={dialog.kind === 'create' ? 'create' : `${dialog.kind}-${dialog.validator.id}`} dialog={dialog} onClose={() => setDialog(null)} onSaved={replace} />}
      <ConfirmDialog
        open={confirm?.kind === 'deactivate'}
        title="Desactivar validador"
        message={confirm ? `${confirm.validator.name} dejará de identificar empleados y su sesión se cerrará de inmediato.` : ''}
        confirmLabel="Desactivar"
        tone="danger"
        loading={busy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && void setActive(confirm.validator, false)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Eliminar validador"
        message={confirm ? `Se eliminará la cuenta de ${confirm.validator.name} (${confirm.validator.email}). La bitácora de sus identificaciones se conserva.` : ''}
        confirmLabel="Eliminar"
        tone="danger"
        loading={busy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && void remove(confirm.validator)}
      />
    </div>
  );
}
