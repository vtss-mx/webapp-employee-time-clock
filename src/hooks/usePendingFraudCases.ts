import { fraudCaseService } from '../services/fraudCaseService';
import { config } from '../utils/config';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:fraud-cases-changed';

/** Avisa al contador del menú que cambió la revisión de algún caso de fraude. */
export function notifyFraudCasesChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => fraudCaseService.count(signal);

/** Casos de fraude por revisar (contador del menú del ADMIN). */
export function usePendingFraudCases(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingFraudCasesPollMs, changedEvent: EVENT });
}
