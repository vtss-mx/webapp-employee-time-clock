import { RefreshCw } from 'lucide-react';
import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { MessageDialog, type MessageAction, type MessageInput } from '../components/MessageDialog';
import { describeError, isHandledGlobally } from '../utils/errorPresentation';
import { ConfirmProvider } from './ConfirmContext';

export interface ErrorMessageOptions {
  /** Contexto de la acción ("No se pudo guardar"); por defecto, uno según el tipo de error. */
  title?: string;
  /** Agrega "Reintentar" y lo ejecuta si se elige. */
  retry?: () => void;
  /** Mostrar también los 401 (solo en el login: credenciales o cuenta desactivada). */
  showAuthErrors?: boolean;
  /** Clave del popup: el mismo error de varias cargas a la vez se muestra una vez y se puede cerrar
   * con `dismiss(key)` cuando se recupera solo. */
  key?: string;
}

type Shortcut = (title: string, text?: ReactNode, extra?: Partial<MessageInput>) => Promise<string | null>;

export interface FeedbackApi {
  /** Abre un popup; se resuelve con el id de la acción elegida o null si se cerró. */
  show: (message: MessageInput) => Promise<string | null>;
  error: Shortcut;
  warning: Shortcut;
  info: Shortcut;
  /** Popup a partir de un error (ApiError, red, inesperado) con su código de rastreo. */
  fromError: (error: unknown, options?: ErrorMessageOptions) => Promise<string | null>;
  /** Formulario con campos inválidos: resumen en popup (los campos siguen marcados). */
  invalidForm: (errors: Record<string, string | undefined>) => Promise<string | null>;
  /** Confirmación de que algo salió bien: popup de éxito, personalizable como los demás. */
  success: Shortcut;
  /** Cierra (o saca de la cola) el mensaje con esa clave. */
  dismiss: (key: string) => void;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

interface QueuedMessage extends MessageInput {
  id: number;
  key: string;
  done: Promise<string | null>;
  resolve: (actionId: string | null) => void;
}

const RETRY_ACTIONS: MessageAction[] = [
  { id: 'close', label: 'Cerrar', variant: 'ghost' },
  { id: 'retry', label: 'Reintentar', variant: 'primary', icon: <RefreshCw size={18} /> },
];

const textKey = (text: ReactNode) => (typeof text === 'string' || typeof text === 'number' ? String(text) : '');

/**
 * Único punto de salida de los mensajes de la aplicación: todo mensaje es un popup (error, advertencia,
 * información y éxito), uno a la vez, en cola y sin duplicados. La aplicación no usa toasts.
 * Cada popup se personaliza con `MessageInput`: variante, ícono, etiqueta, detalles (viñetas,
 * pasos o palomitas), contenido propio, acciones, nota al pie y si se puede cerrar.
 * Monta también las confirmaciones de crear, editar y eliminar (`ConfirmProvider`, `useConfirm`):
 * una sola instancia junto a los mensajes, en la app y en cada prueba que tenga mensajes.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const queueRef = useRef<QueuedMessage[]>([]);
  const nextId = useRef(1);

  const update = useCallback((next: (list: QueuedMessage[]) => QueuedMessage[]) => {
    queueRef.current = next(queueRef.current);
    setQueue(queueRef.current);
  }, []);

  const close = useCallback(
    (id: number, actionId: string | null) => {
      const item = queueRef.current.find((m) => m.id === id);
      if (!item) return;
      update((list) => list.filter((m) => m.id !== id));
      item.resolve(actionId);
    },
    [update],
  );

  const show = useCallback(
    (message: MessageInput): Promise<string | null> => {
      const key = message.key ?? `${message.variant}|${message.title}|${textKey(message.text)}`;
      const existing = queueRef.current.find((m) => m.key === key);
      if (existing) return existing.done;
      // El ejecutor de la promesa corre de inmediato: `resolve` queda asignada antes de usarse.
      let resolve!: (actionId: string | null) => void;
      const done = new Promise<string | null>((r) => (resolve = r));
      update((list) => [...list, { ...message, key, id: nextId.current++, done, resolve }]);
      return done;
    },
    [update],
  );

  const dismiss = useCallback(
    (key: string) => {
      const item = queueRef.current.find((m) => m.key === key);
      if (item) close(item.id, null);
    },
    [close],
  );

  const fromError = useCallback(
    async (error: unknown, { title, retry, showAuthErrors, key }: ErrorMessageOptions = {}) => {
      if (isHandledGlobally(error, { showAuthErrors })) return null;
      const info = describeError(error, title);
      const result = await show({
        key,
        variant: info.variant,
        title: info.title,
        text: info.text,
        details: info.details,
        traceId: info.traceId,
        actions: retry ? RETRY_ACTIONS : undefined,
      });
      if (result === 'retry') retry?.();
      return result;
    },
    [show],
  );

  const invalidForm = useCallback(
    (errors: Record<string, string | undefined>) =>
      show({
        variant: 'warning',
        title: 'Revisa la información',
        text: 'Corrige los campos marcados para continuar.',
        details: [...new Set(Object.values(errors).filter((e): e is string => Boolean(e)))],
        key: 'invalid-form',
      }),
    [show],
  );

  const api = useMemo<FeedbackApi>(() => {
    const shortcut =
      (variant: MessageInput['variant']): Shortcut =>
      (title, text, extra) =>
        show({ ...extra, variant, title, text });
    return {
      show,
      error: shortcut('error'),
      warning: shortcut('warning'),
      info: shortcut('info'),
      success: shortcut('success'),
      fromError,
      invalidForm,
      dismiss,
    };
  }, [show, fromError, invalidForm, dismiss]);

  const current = queue[0];

  return (
    <FeedbackContext.Provider value={api}>
      <ConfirmProvider notify={show}>{children}</ConfirmProvider>
      {current && (
        <MessageDialog
          key={current.id} // cada mensaje se monta de nuevo: foco en su acción principal
          message={current}
          position={1}
          total={queue.length}
          onAction={(actionId) => close(current.id, actionId)}
          onClose={() => close(current.id, null)}
        />
      )}
    </FeedbackContext.Provider>
  );
}
