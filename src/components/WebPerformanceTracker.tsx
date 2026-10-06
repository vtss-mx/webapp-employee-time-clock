import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { startWebPerformance, trackPerfScreen } from '../services/perf/webPerformance';

/**
 * Mide cómo vive la app en este navegador (Web Vitals, tareas largas y latencia de la API) y le dice a los
 * observadores cuándo se cambia de pantalla; no dibuja nada. Se monta una vez en `App.tsx` (como
 * `AnalyticsTracker`); lo apaga `VITE_PERF_ENABLED` y lo muestrea `VITE_PERF_SAMPLE_RATE`.
 */
export function WebPerformanceTracker() {
  const { pathname } = useLocation();
  useEffect(() => startWebPerformance(), []);
  useEffect(() => trackPerfScreen(pathname), [pathname]);
  return null;
}
