import { Power, PowerOff, ToggleRight, Trash2 } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { ApiError } from '../../services/apiClient';
import type { ConfirmInput } from '../../types/confirm';
import { StatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';
import { PanelSection } from '../ui/Panel';

export interface RecordStatusTexts {
  /** Título de la sección ("Estado del turno"). */
  title: string;
  /** Sustantivo con artículo para los avisos ("El turno", "El sitio"). */
  subject: string;
  /** Qué significa cada estado (se muestra bajo el título). */
  activeMeaning: string;
  inactiveMeaning: string;
  /** Qué pasará al desactivar y al eliminar (en la confirmación; al activar se dice `activeMeaning`). */
  deactivateWarning: string;
  removeWarning: string;
  /** Código del backend cuando no se puede eliminar porque está en uso (se sugiere desactivarlo). */
  inUseCode: string;
}

interface RecordStatusProps {
  name: string;
  active: boolean;
  texts: RecordStatusTexts;
  setStatus: (active: boolean) => Promise<{ active: boolean }>;
  remove: () => Promise<void>;
  /** Cambió el estado (el backend devuelve el registro actualizado). */
  onStatus: (active: boolean) => void;
  /** Se eliminó: la pantalla regresa al listado. */
  onRemoved: () => void;
}

/** Activar o desactivar: qué cambia ("Estado: Activo → Inactivo") y qué implica. */
function statusConfirm(name: string, next: boolean, texts: RecordStatusTexts): ConfirmInput {
  const noun = `${texts.subject.toLowerCase()} ${name}`;
  const state = { label: 'Estado', before: next ? 'Inactivo' : 'Activo', after: next ? 'Activo' : 'Inactivo' };
  return next
    ? { tone: 'success', icon: <Power size={30} />, eyebrow: 'Cambiar estado', title: `¿Activar ${noun}?`, message: texts.activeMeaning, changes: [state], confirmLabel: 'Activar', confirmIcon: <Power size={18} /> }
    : { tone: 'danger', icon: <PowerOff size={30} />, eyebrow: 'Cambiar estado', title: `¿Desactivar ${noun}?`, message: texts.deactivateWarning, changes: [state], confirmLabel: 'Desactivar', confirmIcon: <PowerOff size={18} /> };
}

/**
 * Activar/desactivar y eliminar un registro desde su edición (turno o sitio), con confirmación.
 * Si el backend no permite eliminarlo porque está en uso, el popup lo explica y sugiere desactivarlo.
 */
export function RecordStatus({ name, active, texts, setStatus, remove, onStatus, onRemoved }: RecordStatusProps) {
  const { busy, run } = useAction<'status' | 'remove'>();

  const changeStatus = (next: boolean) =>
    run(() => setStatus(next), {
      busy: 'status',
      confirm: statusConfirm(name, next, texts),
      errorTitle: next ? `No se pudo activar ${name}` : `No se pudo desactivar ${name}`,
      success: [next ? `${texts.subject} quedó activo` : `${texts.subject} quedó inactivo`, next ? texts.activeMeaning : texts.inactiveMeaning],
      onSuccess: (saved) => onStatus(saved.active),
    });

  const removeRecord = () =>
    run(remove, {
      busy: 'remove',
      confirm: {
        kind: 'delete',
        title: `¿Eliminar ${texts.subject.toLowerCase()} ${name}?`,
        message: texts.removeWarning,
        note: 'Esta acción no se puede deshacer.',
      },
      errorTitle: (err) => (err instanceof ApiError && err.code === texts.inUseCode ? `${texts.subject} está en uso: desactívalo` : `No se pudo eliminar ${name}`),
      success: [`${texts.subject} se eliminó`, `${name} ya no aparece en tu empresa.`],
      onSuccess: onRemoved,
      keepBusy: true,
    });

  return (
    <PanelSection title={texts.title} icon={<ToggleRight size={20} />} aside={<StatusBadge active={active} />}>
      <p className="muted">{active ? texts.activeMeaning : texts.inactiveMeaning}</p>
      <div className="button-row">
        <Button
          variant={active ? 'warning' : 'success'}
          icon={active ? <PowerOff size={18} /> : <Power size={18} />}
          loading={busy === 'status'}
          disabled={busy !== null}
          onClick={() => void changeStatus(!active)}
        >
          {active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button variant="danger-outline" icon={<Trash2 size={18} />} loading={busy === 'remove'} disabled={busy !== null} onClick={() => void removeRecord()}>
          Eliminar
        </Button>
      </div>
    </PanelSection>
  );
}
