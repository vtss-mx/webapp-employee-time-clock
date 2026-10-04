import { createContext, useContext } from 'react';
import { enrollmentService } from '../services/enrollmentService';
import { usePolledCount } from './usePolledCount';
import { config } from '../utils/config';

const EVENT = 'tc:enrollments-changed';

/** Avisa a los contadores (menú, dashboard) que cambió la cola de validaciones. */
export function notifyEnrollmentsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => enrollmentService.list('PENDING', { page: 1, size: 1 }, signal).then((page) => page.total);

/** Número de registros faciales pendientes de validación (se actualiza periódicamente). */
export function usePendingEnrollments(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingEnrollmentsPollMs, changedEvent: EVENT });
}

/**
 * Pendientes de la consulta única que hace el layout (solo si el menú del usuario lleva ese
 * contador): las pantallas leen este valor en lugar de consultar por su cuenta, así no hay dos
 * consultas periódicas iguales a la vez. null: aún no se sabe o el usuario no lo tiene.
 */
export const PendingEnrollmentsContext = createContext<number | null>(null);

export function usePendingEnrollmentsCount(): number | null {
  return useContext(PendingEnrollmentsContext);
}
