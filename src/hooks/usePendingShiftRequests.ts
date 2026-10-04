import { shiftService } from '../services/shiftService';
import { config } from '../utils/config';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:shift-requests-changed';

/** Avisa al contador del menú que cambió la bandeja de solicitudes de cambio de turno. */
export function notifyShiftRequestsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => shiftService.pendingRequests(signal);

/** Solicitudes de cambio de turno pendientes (contador del menú de la empresa). */
export function usePendingShiftRequests(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingShiftRequestsPollMs, changedEvent: EVENT });
}
