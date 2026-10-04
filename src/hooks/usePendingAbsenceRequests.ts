import { calendarService } from '../services/calendarService';
import { config } from '../utils/config';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:absence-requests-changed';

/** Avisa al contador del menú que cambió la bandeja de solicitudes de vacaciones o permisos. */
export function notifyAbsenceRequestsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => calendarService.pendingAbsences(signal);

/** Solicitudes de vacaciones o permisos por decidir (contador de "Calendario" en el menú de la empresa). */
export function usePendingAbsenceRequests(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingAbsenceRequestsPollMs, changedEvent: EVENT });
}
