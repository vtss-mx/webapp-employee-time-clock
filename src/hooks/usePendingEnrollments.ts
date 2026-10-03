import { useCallback, useEffect, useState } from 'react';
import { enrollmentService } from '../services/enrollmentService';
import { usePolling } from './usePolling';
import { config } from '../utils/config';

const EVENT = 'tc:enrollments-changed';

/** Avisa a los contadores (menú, dashboard) que cambió la cola de validaciones. */
export function notifyEnrollmentsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

/** Número de registros faciales pendientes de validación (se actualiza periódicamente). */
export function usePendingEnrollments(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await enrollmentService.list('PENDING', { page: 1, size: 1 });
    setCount(res.total);
  }, []);

  usePolling(load, { intervalMs: config.pendingEnrollmentsPollMs, enabled });

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void load().catch(() => undefined);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [enabled, load]);

  return count;
}
