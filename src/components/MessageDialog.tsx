import { Check, Copy } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useCopy } from '../hooks/useCopy';
import { t, useT } from '../i18n';
import type { Lazy } from '../i18n/lazy';
import type { MessageVariant } from '../utils/errorPresentation';
import { Button, type ButtonVariant } from './ui/Button';
import { DialogHero } from './ui/DialogHero';
import { Overlay } from './ui/Overlay';

export interface MessageAction {
  id: string;
  label: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export interface MessageInput {
  variant: MessageVariant;
  title: string;
  text?: ReactNode;
  /** Lista bajo el texto: errores por campo, pasos a seguir o garantías. */
  details?: string[];
  detailsStyle?: 'bullets' | 'steps' | 'checks';
  /** Contenido personalizado (p. ej. un código QR). */
  body?: ReactNode;
  /** Ícono propio en lugar del de la variante. */
  icon?: ReactNode;
  /** Etiqueta sobre el título (por defecto la de la variante). */
  eyebrow?: string;
  traceId?: string | null;
  /** Botones; el último es la acción principal. Por defecto, "Entendido". */
  actions?: MessageAction[];
  footnote?: ReactNode;
  /** false: solo se cierra con una acción (sin X, Escape ni clic fuera). */
  dismissible?: boolean;
  /** Mientras un mensaje con la misma clave esté abierto o en cola, no se repite. */
  key?: string;
  /** Más ancho para contenido con dos columnas (p. ej. pasos + código QR). */
  wide?: boolean;
}

/**
 * Un mensaje, o la función que lo arma al dibujarse: así un popup abierto sigue al idioma activo
 * (se vuelve a armar con los textos, fechas y números del idioma nuevo).
 */
export type MessageSource = Lazy<MessageInput>;

const ROLES = { error: 'alertdialog', warning: 'alertdialog', info: 'dialog', success: 'dialog' } as const;

/** Acción por omisión ("Entendido"), en el idioma activo. */
export const defaultActions = (): MessageAction[] => [{ id: 'ok', label: t('feedback.understood'), variant: 'primary' }];

interface MessageDialogProps {
  message: MessageInput;
  /** Posición en la cola ("1 de 3") cuando hay varios mensajes pendientes. */
  position: number;
  total: number;
  onAction: (actionId: string) => void;
  onClose: () => void;
}

/** Popup de mensajes de la aplicación: error, advertencia, información o confirmación. */
export function MessageDialog({ message, position, total, onAction, onClose }: MessageDialogProps) {
  const { variant, title, text, details = [], detailsStyle = 'bullets', body, traceId, footnote } = message;
  const dismissible = message.dismissible ?? true;
  const t = useT();
  const actions = message.actions?.length ? message.actions : defaultActions();
  const titleId = useId();
  const textId = useId();
  const { copied, copy } = useCopy();
  const copyTrace = () => traceId && copy(traceId);

  const List = detailsStyle === 'steps' ? 'ol' : 'ul';

  return (
    <Overlay
      role={ROLES[variant]}
      labelledBy={titleId}
      describedBy={text ? textId : undefined}
      onDismiss={dismissible ? onClose : undefined}
      className={`msg--${variant} ${message.wide ? 'msg--wide' : ''}`}
    >
      <DialogHero
        variant={variant}
        icon={message.icon}
        eyebrow={message.eyebrow}
        title={title}
        titleId={titleId}
        onClose={dismissible ? onClose : undefined}
        queue={total > 1 ? t('feedback.queue', { position, total }) : undefined}
      />

      <div className="msg__content">
        {text && (
          <div id={textId} className="msg__text">
            {text}
          </div>
        )}
        {details.length > 0 && (
          <List className={`msg__details msg__details--${detailsStyle}`}>
            {details.map((detail) => (
              <li key={detail}>
                {detailsStyle === 'checks' && <Check size={16} aria-hidden />}
                <span>{detail}</span>
              </li>
            ))}
          </List>
        )}
        {body}
        {traceId && (
          <div className="msg__trace">
            <span>
              {t('feedback.trace.label')} <code>{traceId}</code>
            </span>
            <button type="button" onClick={copyTrace} aria-label={t('feedback.trace.copy')}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? t('feedback.trace.copied') : t('common.actions.copy')}
            </button>
          </div>
        )}
      </div>

      <div className="msg__footer">
        <div className="msg__actions">
          {actions.map((action, index) => {
            const primary = index === actions.length - 1;
            return (
              <Button
                key={action.id}
                variant={action.variant ?? (primary ? 'primary' : 'ghost')}
                size="lg"
                icon={action.icon}
                onClick={() => onAction(action.id)}
                data-primary={primary ? '' : undefined}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
        {footnote && <small className="msg__footnote">{footnote}</small>}
      </div>
    </Overlay>
  );
}
