import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFeedback } from '../hooks/useFeedback';
import { t } from '../i18n';
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
 * - En el login (nada que perder) recarga sola.
 * - En otras pantallas pregunta en el popup, para no perder lo que se esté capturando. Con la
 *   pestaña en segundo plano no recarga (un formulario a medio llenar se perdería): queda pendiente
 *   y se pregunta al volver a ella.
 */
export function VersionWatcher() {
  const feedback = useFeedback();
  const { pathname } = useLocation();
  const lastCheck = useRef(0);
  const snoozedUntil = useRef(0);
  /** Se detectó con la pestaña oculta: falta preguntar. */
  const pending = useRef(false);

  const apply = useCallback(async () => {
    if (pathname === paths.login) {
      reloadApp();
      return;
    }
    if (document.hidden) {
      pending.current = true;
      return;
    }
    pending.current = false;
    // Se arma al dibujarse: con el popup abierto, un cambio de idioma lo traduce.
    const choice = await feedback.show(() => ({
      variant: 'info',
      icon: <RefreshCw size={30} />,
      eyebrow: t('system.newVersion.eyebrow'),
      title: t('system.newVersion.title'),
      text: t('system.newVersion.text'),
      actions: [
        { id: 'later', label: t('system.newVersion.later'), variant: 'ghost' },
        { id: 'reload', label: t('system.newVersion.reload'), icon: <RefreshCw size={18} /> },
      ],
      key: 'new-version',
    }));
    if (choice === 'reload') reloadApp();
    else snoozedUntil.current = Date.now() + SNOOZE_MS;
  }, [feedback, pathname]);

  const check = useCallback(async () => {
    // Ya se sabe que hay una versión nueva (detectada en segundo plano): no se consulta otra vez.
    if (pending.current) return apply();
    const now = Date.now();
    if (now - lastCheck.current < MIN_GAP_MS || now < snoozedUntil.current) return;
    lastCheck.current = now;
    if (await isOutdated()) await apply();
  }, [apply]);

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
