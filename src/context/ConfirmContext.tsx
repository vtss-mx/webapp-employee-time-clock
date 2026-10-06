import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MessageInput, MessageSource } from '../components/MessageDialog';
import { ConfirmDialog } from '../components/Modal';
import { t, useLocale } from '../i18n';
import { resolveLazy } from '../i18n/lazy';
import type { ConfirmSource } from '../types/confirm';

export interface ConfirmApi {
  /** Abre (o pone en cola) la confirmación; `done` se resuelve true al confirmar y false al cancelar. */
  ask: (input: ConfirmSource) => { id: number; done: Promise<boolean> };
  /** Retira esa confirmación (la pantalla que preguntó se cerró): se resuelve false. */
  cancel: (id: number) => void;
}

export const ConfirmContext = createContext<ConfirmApi | null>(null);

interface PendingConfirm {
  id: number;
  /** Se arma al dibujarse (sigue al idioma activo). */
  input: ConfirmSource;
  resolve: (confirmed: boolean) => void;
}

/** Edición sin cambios: no hay nada que confirmar ni que enviar. */
export const noChangesMessage = (): MessageInput => ({
  variant: 'info',
  title: t('feedback.noChanges.title'),
  text: t('feedback.noChanges.text'),
  key: 'confirm-no-changes',
});

/**
 * Único lugar donde se abren las confirmaciones de crear, editar y eliminar (decisión del dueño del
 * producto: nada se crea, cambia ni borra por accidente). Una a la vez y en orden; cada una se
 * resuelve una sola vez. Lo monta `FeedbackProvider` (junto a los mensajes): toda la app y toda
 * prueba con mensajes tiene confirmaciones. `notify` muestra el aviso "Sin cambios". Al cambiar el
 * idioma se vuelve a dibujar: la confirmación abierta se arma de nuevo con su `input`.
 */
export function ConfirmProvider({ children, notify }: { children: ReactNode; notify: (message: MessageSource) => unknown }) {
  useLocale();
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const queueRef = useRef<PendingConfirm[]>([]);
  const nextId = useRef(1);

  const settle = useCallback((id: number, confirmed: boolean) => {
    const item = queueRef.current.find((pending) => pending.id === id);
    if (!item) return;
    queueRef.current = queueRef.current.filter((pending) => pending.id !== id);
    setQueue(queueRef.current);
    item.resolve(confirmed);
  }, []);

  const ask = useCallback(
    (input: ConfirmSource) => {
      const id = nextId.current++;
      if (resolveLazy(input).changes?.length === 0) {
        void notify(noChangesMessage);
        return { id, done: Promise.resolve(false) };
      }
      // El ejecutor de la promesa corre de inmediato: `resolve` queda asignada antes de usarse.
      let resolve!: (confirmed: boolean) => void;
      const done = new Promise<boolean>((r) => (resolve = r));
      queueRef.current = [...queueRef.current, { id, input, resolve }];
      setQueue(queueRef.current);
      return { id, done };
    },
    [notify],
  );

  // Si la app se desmonta con confirmaciones abiertas, nadie se queda esperando: se cancelan.
  const cancelAll = useCallback(() => {
    queueRef.current.forEach((pending) => pending.resolve(false));
    queueRef.current = [];
  }, []);
  useEffect(() => cancelAll, [cancelAll]);

  const api = useMemo<ConfirmApi>(() => ({ ask, cancel: (id) => settle(id, false) }), [ask, settle]);
  const current = queue[0];

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {current && (
        <ConfirmDialog
          key={current.id} // cada confirmación se monta de nuevo: foco en su botón principal
          open
          {...resolveLazy(current.input)}
          onConfirm={() => settle(current.id, true)}
          onCancel={() => settle(current.id, false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
