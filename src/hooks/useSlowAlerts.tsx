import { Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { paths } from '../routes/paths';
import { performanceService } from '../services/performanceService';
import type { SlowAlertSummary } from '../types/performance';
import { config } from '../utils/config';
import { formatDuration } from '../utils/numbers';
import { useFeedback } from './useFeedback';
import { usePolledValue } from './usePolledCount';

const EVENT = 'tc:slow-alerts-changed';

/**
 * Avisa al contador del menú que cambió el seguimiento de una alerta (se vuelve a consultar ya). `seenOpenedAt`:
 * la apertura que esta pestaña ya conoce (p. ej. la de una alerta que la persona misma reabrió), para que el
 * aviso en vivo no le anuncie lo que acaba de hacer.
 */
export function notifySlowAlertsChanged(seenOpenedAt?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: seenOpenedAt }));
}

const loadSummary = (signal?: AbortSignal) => performanceService.alertsSummary(signal);

/** Instante de una fecha ISO (0 si no se puede leer: nunca parece "más nueva"). */
const instant = (iso: string | undefined) => Date.parse(String(iso)) || 0;

/**
 * Aviso en vivo (regla 18): cuando la alerta abierta más reciente se abrió (o se reabrió) después de lo que esta
 * pestaña ya conocía, UN popup de advertencia con la ruta y su tiempo, y "Ver alerta". La primera respuesta solo
 * fija la base (abrir la app no avisa lo que ya estaba abierto) y cada apertura se avisa una sola vez.
 */
function useSlowAlertNotice(summary: SlowAlertSummary | null, enabled: boolean) {
  const feedback = useFeedback();
  const navigate = useNavigate();
  const seen = useRef({ primed: false, until: 0 });

  useEffect(() => {
    if (!enabled) return;
    const onChange = (event: Event) => {
      seen.current.until = Math.max(seen.current.until, instant((event as CustomEvent<string | undefined>).detail));
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [enabled]);

  useEffect(() => {
    if (!summary) return;
    const { latest } = summary;
    const opened = instant(latest?.opened_at);
    const { primed, until } = seen.current;
    seen.current = { primed: true, until: Math.max(until, opened) };
    if (!primed || !latest || opened <= until) return;
    void feedback
      .show(() => ({
        key: `slow-alert:${latest.id}:${latest.opened_at}`,
        variant: 'warning',
        icon: <Timer size={30} />,
        eyebrow: t('performance.notice.eyebrow'),
        title: t('performance.notice.title'),
        text: t('performance.notice.text', { route: latest.route, time: formatDuration(latest.last_ms) }),
        footnote: t('performance.notice.footnote'),
        actions: [
          { id: 'close', label: t('common.actions.close'), variant: 'ghost' },
          { id: 'open', label: t('performance.notice.open'), variant: 'primary', icon: <Timer size={18} /> },
        ],
      }))
      .then((choice) => {
        if (choice === 'open') void navigate(paths.admin.performanceAlert(latest.id));
      });
  }, [summary, feedback, navigate]);
}

/**
 * Alertas de peticiones lentas (ADMIN, solo con la pantalla Rendimiento): UNA consulta periódica del resumen
 * (`config.slowAlertsPollMs`, en pausa con la pestaña oculta) alimenta el contador del menú (`open`) y el aviso
 * en vivo de una alerta nueva o reabierta.
 */
export function useSlowAlerts(enabled: boolean): number | null {
  const summary = usePolledValue(loadSummary, { enabled, intervalMs: config.slowAlertsPollMs, changedEvent: EVENT });
  useSlowAlertNotice(summary, enabled);
  return summary ? summary.open : null;
}
