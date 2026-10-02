import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MessageVariant } from '../../utils/errorPresentation';

const VARIANTS = {
  error: { icon: XCircle, eyebrow: 'Error' },
  warning: { icon: AlertTriangle, eyebrow: 'Atención' },
  info: { icon: Info, eyebrow: 'Información' },
  success: { icon: CheckCircle2, eyebrow: 'Listo' },
} as const;

interface DialogHeroProps {
  variant: MessageVariant;
  title: ReactNode;
  titleId: string;
  icon?: ReactNode;
  eyebrow?: string;
  /** Muestra la X de cerrar. */
  onClose?: () => void;
  /** "1 de 3" cuando hay mensajes en cola. */
  queue?: string;
}

/** Encabezado común de mensajes y confirmaciones: ícono con halo, etiqueta y título. */
export function DialogHero({ variant, title, titleId, icon, eyebrow, onClose, queue }: DialogHeroProps) {
  const meta = VARIANTS[variant];
  const Icon = meta.icon;
  return (
    <div className="msg__hero">
      {queue && <span className="msg__queue">{queue}</span>}
      {onClose && (
        <button type="button" className="msg__close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      )}
      <span className="msg__icon" aria-hidden>
        {icon ?? <Icon size={30} />}
      </span>
      <span className="msg__eyebrow">{eyebrow ?? meta.eyebrow}</span>
      <h2 id={titleId} className="msg__title">
        {title}
      </h2>
    </div>
  );
}
