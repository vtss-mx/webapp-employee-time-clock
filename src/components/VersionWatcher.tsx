import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFeedback } from '../hooks/useFeedback';
import { paths } from '../routes/paths';
import { isOutdated, reloadApp } from '../services/versionService';
import { config } from '../utils/config';

/** Separación mínima entre revisiones (cambios de pantalla seguidos no repiten la consulta). */
const MIN_GAP_MS = 15_000;
/** Si eligen "Más tarde", no se vuelve a preguntar durante este tiempo. */
const SNOOZE_MS = 10 * 60_000;

/**
 * Detecta que se publicó una versión nueva del frontend y la aplica: así una pestaña abierta
 * antes de un despliegue nunca sigue mostrando pantallas o mensajes de la versión anterior.
 * - En el login o con la pestaña en segundo plano (nada que perder) recarga sola.
 * - En otras pantallas pregunta en el popup, para no perder lo que se esté capturando.
 */
export function VersionWatcher() {
  const feedback = useFeedback();
  const { pathname } = useLocation();
  const lastCheck = useRef(0);
  const snoozedUntil = useRef(0);

  const check = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheck.current < MIN_GAP_MS || now < snoozedUntil.current) return;
    lastCheck.current = now;
    if (!(await isOutdated())) return;
    if (pathname === paths.login || document.hidden) {
      reloadApp();
      return;
    }
    const choice = await feedback.show({
      variant: 'info',
      icon: <RefreshCw size={30} />,
      eyebrow: 'Actualización',
      title: 'Hay una nueva versión de la aplicación',
      text: 'Actualiza para usar las mejoras y correcciones más recientes. Solo toma un momento.',
      actions: [
        { id: 'later', label: 'Más tarde', variant: 'ghost' },
        { id: 'reload', label: 'Actualizar ahora', icon: <RefreshCw size={18} /> },
      ],
      key: 'new-version',
    });
    if (choice === 'reload') reloadApp();
    else snoozedUntil.current = Date.now() + SNOOZE_MS;
  }, [feedback, pathname]);

  // Al cambiar de pantalla.
  useEffect(() => {
    void check();
  }, [check]);

  // Periódicamente y al volver a la pestaña o a la ventana.
  useEffect(() => {
    const onVisible = () => !document.hidden && void check();
    const timer = window.setInterval(() => void check(), config.versionCheckMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  return null;
}
