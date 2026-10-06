import { Power, PowerOff, ToggleRight, Trash2 } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { t as translate, useT } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import type { ConfirmInput } from '../../types/confirm';
import { StatusBadge } from '../StatusBadge';
import { deleteNote } from '../trash/TrashParts';
import { Button } from '../ui/Button';
import { PanelSection } from '../ui/Panel';

/** Los textos de la sección según el registro (turno o sitio), ya traducidos y con su nombre puesto. */
export interface RecordStatusTexts {
  /** Título de la sección ("Estado del turno"). */
  title: string;
  /** Qué significa cada estado (se muestra bajo el título). */
  activeMeaning: string;
  inactiveMeaning: string;
  /** Qué pasará al desactivar y al eliminar (en la confirmación; al activar se dice `activeMeaning`). */
  deactivateWarning: string;
  removeWarning: string;
  /** Las preguntas de las confirmaciones ("¿Activar el turno Nocturno?"). */
  activateQuestion: string;
  deactivateQuestion: string;
  removeQuestion: string;
  /** Los avisos al terminar ("El turno quedó activo", "El turno se eliminó"). */
  activated: string;
  deactivated: string;
  removed: string;
  /** Título del popup cuando no se puede eliminar porque está en uso ("El turno está en uso: desactívalo"). */
  inUse: string;
  /** Códigos del backend cuando no se puede eliminar porque está en uso (se sugiere desactivarlo). */
  inUseCodes: readonly string[];
}

interface RecordStatusProps {
  name: string;
  active: boolean;
  /**
   * Los textos, calculados al usarse: las confirmaciones y los avisos abiertos se vuelven a armar
   * con ella y siguen al idioma activo.
   */
  texts: () => RecordStatusTexts;
  setStatus: (active: boolean) => Promise<{ active: boolean }>;
  remove: () => Promise<void>;
  /** Cambió el estado (el backend devuelve el registro actualizado). */
  onStatus: (active: boolean) => void;
  /** Se eliminó: la pantalla regresa al listado. */
  onRemoved: () => void;
}

/** Activar o desactivar: qué cambia ("Estado: Activo → Inactivo") y qué implica. */
function statusConfirm(next: boolean, texts: RecordStatusTexts): ConfirmInput {
  const [active, inactive] = [translate('common.states.active'), translate('common.states.inactive')];
  const state = { label: translate('common.fields.status'), before: next ? inactive : active, after: next ? active : inactive };
  const eyebrow = translate('common.actions.changeStatus');
  return next
    ? { tone: 'success', icon: <Power size={30} />, eyebrow, title: texts.activateQuestion, message: texts.activeMeaning, changes: [state], confirmLabel: translate('common.actions.activate'), confirmIcon: <Power size={18} /> }
    : { tone: 'danger', icon: <PowerOff size={30} />, eyebrow, title: texts.deactivateQuestion, message: texts.deactivateWarning, changes: [state], confirmLabel: translate('common.actions.deactivate'), confirmIcon: <PowerOff size={18} /> };
}

/**
 * Activar/desactivar y eliminar un registro desde su edición (turno o sitio), con confirmación.
 * Si el backend no permite eliminarlo porque está en uso, el popup lo explica y sugiere desactivarlo.
 */
export function RecordStatus({ name, active, texts, setStatus, remove, onStatus, onRemoved }: RecordStatusProps) {
  const t = useT();
  const { busy, run } = useAction<'status' | 'remove'>();
  const current = texts();

  const changeStatus = (next: boolean) =>
    run(() => setStatus(next), {
      busy: 'status',
      confirm: () => statusConfirm(next, texts()),
      errorTitle: () => translate(next ? 'shifts.recordStatus.activateError' : 'shifts.recordStatus.deactivateError', { name }),
      success: () => (next ? [texts().activated, texts().activeMeaning] : [texts().deactivated, texts().inactiveMeaning]),
      onSuccess: (saved) => onStatus(saved.active),
    });

  const removeRecord = () =>
    run(remove, {
      busy: 'remove',
      // Va a «Eliminados» (se restaura durante 1 año).
      confirm: () => ({ kind: 'delete', title: texts().removeQuestion, message: texts().removeWarning, note: deleteNote() }),
      // El motivo lo da el backend (p. ej. qué turnos usan el sitio); el título sugiere qué hacer.
      errorTitle: (err) => (err instanceof ApiError && texts().inUseCodes.includes(err.code) ? texts().inUse : translate('shifts.recordStatus.removeError', { name })),
      success: () => [texts().removed],
      onSuccess: onRemoved,
      keepBusy: true,
    });

  return (
    <PanelSection title={current.title} icon={<ToggleRight size={20} />} aside={<StatusBadge active={active} />}>
      <p className="muted">{active ? current.activeMeaning : current.inactiveMeaning}</p>
      <div className="button-row">
        <Button
          variant={active ? 'warning' : 'success'}
          icon={active ? <PowerOff size={18} /> : <Power size={18} />}
          loading={busy === 'status'}
          disabled={busy !== null}
          onClick={() => void changeStatus(!active)}
        >
          {active ? t('common.actions.deactivate') : t('common.actions.activate')}
        </Button>
        <Button variant="danger-outline" icon={<Trash2 size={18} />} loading={busy === 'remove'} disabled={busy !== null} onClick={() => void removeRecord()}>
          {t('common.actions.delete')}
        </Button>
      </div>
    </PanelSection>
  );
}
