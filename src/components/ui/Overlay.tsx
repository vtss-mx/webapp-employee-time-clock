import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockScroll } from '../../utils/scrollLock';

/** Ventanas abiertas, de abajo hacia arriba: Escape cierra solo la de encima. */
const stack: symbol[] = [];

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface OverlayProps {
  children: ReactNode;
  /** Cerrar con Escape o clic en el fondo; sin él, solo se cierra con sus propias acciones. */
  onDismiss?: () => void;
  role?: 'dialog' | 'alertdialog';
  labelledBy?: string;
  describedBy?: string;
  /** Clases extra de la tarjeta (variante de color, ancho). */
  className?: string;
}

/**
 * Base ÚNICA de todas las ventanas emergentes (mensajes, confirmaciones, formularios, QR):
 * - Se monta en <body> con un portal. Dentro de la página, un ancestro con `transform`
 *   (animaciones de entrada) limitaría el `position: fixed` y el fondo no cubriría toda la
 *   pantalla (menú lateral y encabezado quedaban sin oscurecer).
 * - Fondo translúcido con desenfoque, misma tarjeta y animación; hoja inferior en teléfonos.
 * - Bloquea el desplazamiento, mantiene el foco dentro y lo devuelve al cerrar.
 */
export function Overlay({ children, onDismiss, role = 'dialog', labelledBy, describedBy, className = '' }: OverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const id = Symbol('overlay');
    stack.push(id);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();
    const card = cardRef.current;
    (card?.querySelector<HTMLElement>('[data-autofocus]') ?? card?.querySelector<HTMLElement>('[data-primary]') ?? card)?.focus();
    // Escape en todo el documento (aunque el foco haya quedado fuera), solo para la de encima.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || stack[stack.length - 1] !== id || !dismissRef.current) return;
      event.stopPropagation();
      dismissRef.current();
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      stack.splice(stack.indexOf(id), 1);
      document.removeEventListener('keydown', onEscape);
      unlock();
      previous?.focus?.();
    };
  }, []);

  /** El foco no sale de la ventana con Tab / Shift+Tab. */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !cardRef.current) return;
    const items = [...cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="msg-layer" onMouseDown={(e) => onDismiss && e.target === e.currentTarget && onDismiss()}>
      <div
        ref={cardRef}
        className={`msg ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
