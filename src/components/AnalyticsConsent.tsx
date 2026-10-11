import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { analyticsAvailable, setAnalyticsConsent, type AnalyticsConsentChoice } from '../services/analytics';
import { deviceStore } from '../utils/deviceStore';
import { Button } from './ui/Button';

/** La respuesta vive en ESTE dispositivo (IndexedDB, regla 13: nada de `localStorage`). */
const KEY = 'analyticsConsent';

const isChoice = (value: unknown): value is AnalyticsConsentChoice => value === 'granted' || value === 'denied';

/**
 * Pide permiso ANTES de medir el uso (ePrivacy y RGPD: acceder al almacenamiento del navegador para analítica exige
 * consentimiento previo; en Francia y España se sanciona de forma habitual). Mientras no haya un «sí» explícito, el
 * SDK de analítica ni siquiera se carga (`analytics.ts`).
 *
 * No se dibuja nada si la analítica no está configurada en este despliegue (no tendría sentido preguntar) ni una vez
 * que la persona respondió: su respuesta se recuerda por dispositivo. Rechazar no degrada ninguna función.
 */
export function AnalyticsConsent() {
  const t = useT();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!analyticsAvailable()) return;
    let alive = true;
    void deviceStore.get(KEY).then((saved) => {
      if (!alive) return;
      // Ya respondió en este dispositivo: se respeta su decisión sin volver a preguntar.
      if (isChoice(saved)) setAnalyticsConsent(saved);
      else setAsking(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const answer = (choice: AnalyticsConsentChoice) => {
    setAnalyticsConsent(choice);
    setAsking(false);
    void deviceStore.set(KEY, choice);
  };

  if (!asking) return null;
  return (
    <aside className="consent-bar" role="region" aria-label={t('app.analytics.title')}>
      <div className="consent-bar__text">
        <strong>{t('app.analytics.title')}</strong>
        <span>{t('app.analytics.body')}</span>
      </div>
      <div className="consent-bar__actions">
        <Button size="sm" variant="ghost" onClick={() => answer('denied')}>
          {t('app.analytics.decline')}
        </Button>
        <Button size="sm" variant="primary" onClick={() => answer('granted')}>
          {t('app.analytics.accept')}
        </Button>
      </div>
    </aside>
  );
}
