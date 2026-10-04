import { AlertTriangle, ArrowRight, CheckCircle2, FilePlus2, HelpCircle, Info, PencilLine, Plus, Save, Trash2, type LucideIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { ConfirmDetail, ConfirmInput, ConfirmKind, ConfirmTone, FieldChange } from '../types/confirm';
import type { MessageVariant } from '../utils/errorPresentation';
import { FormField } from './FormField';
import { Button } from './ui/Button';
import { DialogHero } from './ui/DialogHero';
import { Overlay } from './ui/Overlay';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Color e ícono del encabezado (mismo sistema que los mensajes). */
  variant?: MessageVariant;
  icon?: ReactNode;
  eyebrow?: string;
}

/** Ventana con contenido propio (formulario, código QR...). Misma base que todos los popups. */
export function Modal({ open, title, onClose, children, footer, wide = false, variant = 'info', icon, eyebrow }: ModalProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <Overlay labelledBy={titleId} onDismiss={onClose} className={`msg--${variant} ${wide ? 'msg--wide' : ''}`}>
      <DialogHero variant={variant} icon={icon} eyebrow={eyebrow} title={title} titleId={titleId} onClose={onClose} />
      <div className="msg__content msg__content--form">{children}</div>
      {footer && (
        <div className="msg__footer">
          <div className="msg__actions">{footer}</div>
        </div>
      )}
    </Overlay>
  );
}

interface ConfirmDialogProps extends ConfirmInput {
  open: boolean;
  /** La acción se procesa con el popup abierto (botón "ocupado"; no se puede cerrar). */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Color de cada tono: variante del popup, ícono genérico (`kind="action"`) y botón principal. */
const TONES = {
  primary: { variant: 'info', icon: HelpCircle, button: 'primary' },
  success: { variant: 'success', icon: CheckCircle2, button: 'success' },
  warning: { variant: 'warning', icon: AlertTriangle, button: 'warning' },
  danger: { variant: 'error', icon: AlertTriangle, button: 'danger' },
} as const;

/**
 * Lo que pone cada tipo de confirmación por omisión (todo se puede cambiar con `ConfirmInput`):
 * crear en azul con "Crear", editar con "Guardar cambios" y eliminar en rojo con "Eliminar".
 */
const KINDS: Record<ConfirmKind, { tone: ConfirmTone; icon?: LucideIcon; button?: LucideIcon; eyebrow: string; confirmLabel: string }> = {
  create: { tone: 'primary', icon: FilePlus2, button: Plus, eyebrow: 'Nuevo registro', confirmLabel: 'Crear' },
  edit: { tone: 'primary', icon: PencilLine, button: Save, eyebrow: 'Confirmar cambios', confirmLabel: 'Guardar cambios' },
  delete: { tone: 'danger', icon: Trash2, button: Trash2, eyebrow: 'Eliminar', confirmLabel: 'Eliminar' },
  action: { tone: 'primary', eyebrow: 'Confirmación', confirmLabel: 'Confirmar' },
};

/** Apariencia final de una confirmación: lo que pidió quien pregunta y, si no, lo de su tipo. */
function confirmLook({ kind = 'action', tone, icon, eyebrow, confirmLabel, confirmIcon, cancelLabel }: ConfirmInput) {
  const preset = KINDS[kind];
  const style = TONES[tone ?? preset.tone];
  const HeroIcon = preset.icon ?? style.icon;
  const ButtonIcon = preset.button;
  return {
    style,
    icon: icon ?? <HeroIcon size={30} />,
    eyebrow: eyebrow ?? preset.eyebrow,
    confirmLabel: confirmLabel ?? preset.confirmLabel,
    confirmIcon: confirmIcon ?? (ButtonIcon && <ButtonIcon size={18} />),
    cancelLabel: cancelLabel ?? 'Cancelar',
  };
}

/** Edición: los campos que cambian, "antes → después". */
function ChangeList({ changes }: { changes: FieldChange[] }) {
  return (
    <section className="confirm-block" aria-label="Cambios">
      <h3 className="confirm-block__title">
        {changes.length === 1 ? '1 cambio' : `${changes.length} cambios`}
      </h3>
      <ul className="confirm-changes">
        {changes.map((change) => (
          <li key={change.label}>
            <span className="confirm-changes__label">{change.label}</span>
            <span className="confirm-changes__values">
              <span className="confirm-changes__before">
                <span className="sr-only">Antes: </span>
                {change.before}
              </span>
              <ArrowRight size={16} aria-hidden className="confirm-changes__arrow" />
              <span className="confirm-changes__after">
                <span className="sr-only">Después: </span>
                {change.after}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lo que se crea o se afecta: líneas sueltas o filas "Etiqueta: valor". */
function DetailList({ title, details }: { title?: string; details: ConfirmDetail[] }) {
  return (
    <section className="confirm-block" aria-label={title ?? 'Detalles'}>
      {title && <h3 className="confirm-block__title">{title}</h3>}
      <ul className="confirm-facts">
        {details.map((detail, index) =>
          typeof detail === 'string' ? (
            <li key={index} className="confirm-facts__line">
              {detail}
            </li>
          ) : (
            <li key={index}>
              <span className="confirm-facts__label">{detail.label}</span>
              <span className="confirm-facts__value">{detail.value}</span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

/**
 * Confirmación de crear, editar, eliminar o cualquier acción: título, qué pasará, lo que se crea o
 * los cambios ("antes → después"), la consecuencia y, si es muy destructiva, el texto que se escribe
 * para habilitarla. Misma base que todos los popups. Las pantallas no la montan: preguntan con
 * `useConfirm()` (o la opción `confirm` de `useAction`/`useSubmit`/`useFormState.save`).
 */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  // Montada solo mientras está abierta: el texto escrito para confirmar empieza vacío cada vez.
  return open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({ loading = false, onConfirm, onCancel, ...input }: Omit<ConfirmDialogProps, 'open'>) {
  const { title, message, details, detailsTitle, changes, note, confirmText } = input;
  const titleId = useId();
  const textId = useId();
  const [typed, setTyped] = useState('');
  const confirmed = !confirmText || typed.trim() === confirmText.trim();
  const look = confirmLook(input);
  const cancel = loading ? undefined : onCancel;
  return (
    <Overlay
      role={look.style.variant === 'error' || look.style.variant === 'warning' ? 'alertdialog' : 'dialog'}
      labelledBy={titleId}
      describedBy={message ? textId : undefined}
      onDismiss={cancel}
      className={`msg--${look.style.variant} msg--confirm`}
    >
      <DialogHero variant={look.style.variant} icon={look.icon} eyebrow={look.eyebrow} title={title} titleId={titleId} onClose={cancel} />
      <div className="msg__content">
        {message && (
          <div id={textId} className="msg__text">
            {message}
          </div>
        )}
        {changes && changes.length > 0 && <ChangeList changes={changes} />}
        {details && details.length > 0 && <DetailList title={detailsTitle} details={details} />}
        {note && (
          <p className="confirm-note">
            <Info size={18} aria-hidden />
            <span>{note}</span>
          </p>
        )}
        {confirmText && (
          <FormField
            label={`Escribe «${confirmText}» para confirmar`}
            value={typed}
            autoComplete="off"
            disabled={loading}
            data-autofocus=""
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
      </div>
      <div className="msg__footer">
        <div className="msg__actions">
          {/* En lo destructivo el foco empieza en "Cancelar": un Enter de más no borra nada. */}
          <Button variant="ghost" size="lg" onClick={onCancel} disabled={loading} data-autofocus={look.style.variant === 'error' && !confirmText ? '' : undefined}>
            {look.cancelLabel}
          </Button>
          <Button variant={look.style.button} size="lg" icon={look.confirmIcon} onClick={onConfirm} loading={loading} disabled={!confirmed} data-primary="">
            {look.confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
