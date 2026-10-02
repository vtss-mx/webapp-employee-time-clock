import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
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

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'success' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Acciones irreversibles: la persona escribe este texto (p. ej. el nombre de la empresa) para
   * habilitar el botón. Evita confirmar por inercia.
   */
  confirmText?: string;
}

const TONES = {
  danger: { variant: 'error', icon: <AlertTriangle size={30} />, button: 'danger' },
  success: { variant: 'success', icon: <CheckCircle2 size={30} />, button: 'success' },
  primary: { variant: 'info', icon: <HelpCircle size={30} />, button: 'primary' },
} as const;

/** Confirmación de una acción (eliminar, desactivar, aceptar...). Misma base que todos los popups. */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  // Montada solo mientras está abierta: el texto escrito para confirmar empieza vacío cada vez.
  return open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({
  title,
  message,
  confirmLabel = 'Confirmar',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  confirmText,
}: Omit<ConfirmDialogProps, 'open'>) {
  const titleId = useId();
  const textId = useId();
  const [typed, setTyped] = useState('');
  const confirmed = !confirmText || typed.trim() === confirmText.trim();
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
          <Button variant="ghost" size="lg" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={style.button} size="lg" onClick={onConfirm} loading={loading} disabled={!confirmed} data-primary="">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
