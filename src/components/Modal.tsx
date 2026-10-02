import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { MessageVariant } from '../utils/errorPresentation';
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

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'success' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONES = {
  danger: { variant: 'error', icon: <AlertTriangle size={30} />, button: 'danger' },
  success: { variant: 'success', icon: <CheckCircle2 size={30} />, button: 'success' },
  primary: { variant: 'info', icon: <HelpCircle size={30} />, button: 'primary' },
} as const;

/** Confirmación de una acción (eliminar, desactivar, aceptar...). Misma base que todos los popups. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const textId = useId();
  if (!open) return null;
  const style = TONES[tone];
  return (
    <Overlay
      role={tone === 'danger' ? 'alertdialog' : 'dialog'}
      labelledBy={titleId}
      describedBy={textId}
      onDismiss={loading ? undefined : onCancel}
      className={`msg--${style.variant}`}
    >
      <DialogHero
        variant={style.variant}
        icon={style.icon}
        eyebrow="Confirmación"
        title={title}
        titleId={titleId}
        onClose={loading ? undefined : onCancel}
      />
      <div className="msg__content">
        <div id={textId} className="msg__text">
          {message}
        </div>
      </div>
      <div className="msg__footer">
        <div className="msg__actions">
          <Button variant="ghost" size="lg" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={style.button} size="lg" onClick={onConfirm} loading={loading} data-primary="">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
