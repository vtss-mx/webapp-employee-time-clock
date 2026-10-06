import { useCallback, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';
import { useMountedRef } from '../hooks/useMountedRef';
import { currentLocale, setLocale, t, type Locale } from './core';
import { rememberDeviceLocale } from './device';
import { useLocale } from './react';

/**
 * Cambiar el idioma (selector del inicio de sesión y de Mi perfil). EN CALIENTE: se descarga el
 * diccionario si hace falta y toda la app se redibuja en el idioma nuevo al instante, sin recargar la
 * página ni perder lo que la persona hacía (formularios, popups abiertos, cámara). Se recuerda en el
 * dispositivo y, con sesión, se guarda en la cuenta (`PATCH /users/me/preferences {locale}`); al
 * cambiar, `LocaleSync` vuelve a pedir el usuario y `CatalogProvider` los catálogos (sus nombres
 * llegan del backend en el idioma de la petición). No se confirma: es una preferencia de la
 * interfaz. Si no se puede guardar en la cuenta, se regresa al idioma anterior y se avisa.
 */
export function useLanguage() {
  const locale = useLocale();
  const { isAuthenticated, updatePreferences } = useAuth();
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [changing, setChanging] = useState<Locale | null>(null);

  const change = useCallback(
    async (next: Locale) => {
      // El selector solo avisa cuando se elige otro idioma: `next` siempre es distinto del actual.
      const previous = currentLocale();
      setChanging(next);
      let title = () => t('language.loadFailed');
      try {
        await setLocale(next);
        void rememberDeviceLocale(next);
        if (isAuthenticated) {
          title = () => t('language.saveFailed');
          await updatePreferences({ locale: next }).catch(async (error: unknown) => {
            await setLocale(previous);
            void rememberDeviceLocale(previous);
            throw error;
          });
        }
      } catch (error) {
        void feedback.fromError(error, { title });
      } finally {
        if (mounted.current) setChanging(null);
      }
    },
    [isAuthenticated, updatePreferences, feedback, mounted],
  );

  return { locale, change, changing };
}
