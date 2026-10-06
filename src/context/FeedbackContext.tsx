import { RefreshCw } from 'lucide-react';
import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { MessageDialog, type MessageAction, type MessageInput, type MessageSource } from '../components/MessageDialog';
import { t, useLocale } from '../i18n';
import { resolveLazy, type Lazy, type LazyNode, type LazyText } from '../i18n/lazy';
import { describeError, isHandledGlobally } from '../utils/errorPresentation';
import { ConfirmProvider } from './ConfirmContext';

export interface ErrorMessageOptions {
  /**
   * Contexto de la acción ("No se pudo guardar"); por defecto, uno según el tipo de error. Con una
   * función (`() => t('…')`) el popup abierto sigue al idioma activo.
   */
  title?: LazyText;
  /** Agrega "Reintentar" y lo ejecuta si se elige. */
  retry?: () => void;
  /** Mostrar también los 401 (solo en el login: credenciales o cuenta desactivada). */
  showAuthErrors?: boolean;
  /** Clave del popup: el mismo error de varias cargas a la vez se muestra una vez y se puede cerrar
   * con `dismiss(key)` cuando se recupera solo. */
  key?: string;
}

/** Popup rápido: título y texto fijos o, para que sigan al idioma con el popup abierto, funciones. */
type Shortcut = (title: LazyText, text?: LazyNode, extra?: Partial<MessageInput>) => Promise<string | null>;

export interface FeedbackApi {
  /**
   * Abre un popup; se resuelve con el id de la acción elegida o null si se cerró. Con una función
   * (`() => ({ title: t('…'), … })`) el popup se arma al dibujarse y sigue al idioma activo.
   */
  show: (message: MessageSource) => Promise<string | null>;
  error: Shortcut;
  warning: Shortcut;
  info: Shortcut;
  /** Popup a partir de un error (ApiError, red, inesperado) con su código de rastreo. */
  fromError: (error: unknown, options?: ErrorMessageOptions) => Promise<string | null>;
  /**
   * Formulario con campos inválidos: resumen en popup (los campos siguen marcados). Con una función
   * que calcula los errores, el resumen abierto sigue al idioma activo.
   */
  invalidForm: (errors: Lazy<Record<string, string | undefined>>) => Promise<string | null>;
  /** Confirmación de que algo salió bien: popup de éxito, personalizable como los demás. */
  success: Shortcut;
  /** Cierra (o saca de la cola) el mensaje con esa clave. */
  dismiss: (key: string) => void;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

interface QueuedMessage {
  id: number;
  key: string;
  /** Se arma al dibujarse (sigue al idioma activo). */
  source: MessageSource;
  done: Promise<string | null>;
  resolve: (actionId: string | null) => void;
}

const retryActions = (): MessageAction[] => [
  { id: 'close', label: t('common.actions.close'), variant: 'ghost' },
  { id: 'retry', label: t('common.actions.retry'), variant: 'primary', icon: <RefreshCw size={18} /> },
];

const textKey = (text: ReactNode) => (typeof text === 'string' || typeof text === 'number' ? String(text) : '');

/**
 * Único punto de salida de los mensajes de la aplicación: todo mensaje es un popup (error, advertencia,
 * información y éxito), uno a la vez, en cola y sin duplicados. La aplicación no usa toasts.
 * Cada popup se personaliza con `MessageInput`: variante, ícono, etiqueta, detalles (viñetas,
 * pasos o palomitas), contenido propio, acciones, nota al pie y si se puede cerrar.
 * Monta también las confirmaciones de crear, editar y eliminar (`ConfirmProvider`, `useConfirm`):
 * una sola instancia junto a los mensajes, en la app y en cada prueba que tenga mensajes.
 * Al cambiar el idioma se vuelve a dibujar: el popup abierto se arma de nuevo con su `source`.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  useLocale();
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
    (source: MessageSource): Promise<string | null> => {
      const message = resolveLazy(source);
      const key = message.key ?? `${message.variant}|${message.title}|${textKey(message.text)}`;
      const existing = queueRef.current.find((m) => m.key === key);
      if (existing) return existing.done;
      // El ejecutor de la promesa corre de inmediato: `resolve` queda asignada antes de usarse.
      let resolve!: (actionId: string | null) => void;
      const done = new Promise<string | null>((r) => (resolve = r));
      update((list) => [...list, { source, key, id: nextId.current++, done, resolve }]);
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
      // Se describe al dibujarse: con el popup abierto, un cambio de idioma traduce su título, sus
      // botones y los textos que armó la app (los del servidor ya llegaron en su idioma).
      const result = await show(() => {
        const info = describeError(error, title === undefined ? undefined : resolveLazy(title));
        return { key, variant: info.variant, title: info.title, text: info.text, details: info.details, traceId: info.traceId, actions: retry ? retryActions() : undefined };
      });
      if (result === 'retry') retry?.();
      return result;
    },
    [show],
  );

  const invalidForm = useCallback(
    (errors: Lazy<Record<string, string | undefined>>) =>
      show(() => ({
        variant: 'warning',
        title: t('feedback.invalidForm.title'),
        text: t('feedback.invalidForm.text'),
        details: [...new Set(Object.values(resolveLazy(errors)).filter((e): e is string => Boolean(e)))],
        key: 'invalid-form',
      })),
    [show],
  );

  const api = useMemo<FeedbackApi>(() => {
    const shortcut =
      (variant: MessageInput['variant']): Shortcut =>
      (title, text, extra) =>
        show(() => ({ ...extra, variant, title: resolveLazy(title), text: resolveLazy(text) }));
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
          message={resolveLazy(current.source)}
          position={1}
          total={queue.length}
          onAction={(actionId) => close(current.id, actionId)}
          onClose={() => close(current.id, null)}
        />
      )}
    </FeedbackContext.Provider>
  );
}
