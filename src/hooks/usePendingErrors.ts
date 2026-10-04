import { errorReportService } from '../services/errorReportService';
import { config } from '../utils/config';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:errors-changed';

/** Avisa al contador del menú que cambió el seguimiento de algún error. */
export function notifyErrorsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => errorReportService.summary(signal).then((summary) => summary.pending);

/** Errores del sistema pendientes (contador del menú del ADMIN). */
export function usePendingErrors(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingErrorsPollMs, changedEvent: EVENT });
}
