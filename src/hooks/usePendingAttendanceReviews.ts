import { attendanceService } from '../services/attendanceService';
import { config } from '../utils/config';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:attendance-reviews-changed';

/** Avisa al contador del menú que la empresa confirmó o rechazó un registro "en revisión". */
export function notifyAttendanceReviewsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

const countPending = (signal?: AbortSignal) => attendanceService.reviewCount(signal);

/** Registros de asistencia "en revisión" por decidir (contador del menú de la empresa). */
export function usePendingAttendanceReviews(enabled: boolean): number | null {
  return usePolledCount(countPending, { enabled, intervalMs: config.pendingAttendanceReviewsPollMs, changedEvent: EVENT });
}
