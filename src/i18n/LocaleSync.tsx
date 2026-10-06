import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';
import { currentLocale, isLocale, setLocale, t } from './core';
import { rememberDeviceLocale } from './device';
import { useLocale } from './react';

/**
 * Une el idioma de la cuenta con el de la app (va dentro de `AuthProvider`):
 * - Al iniciar sesión o restaurarla, el idioma guardado en la cuenta (`user.preferences.locale`)
 *   manda sobre el del dispositivo; también si cambia desde otro dispositivo (se nota al volver a la
 *   pestaña). Se recuerda en este dispositivo para el próximo inicio de sesión.
 * - Cada vez que cambia el idioma con sesión, se vuelve a pedir el usuario: los nombres de sus
 *   pantallas y módulos del menú llegan del backend en el idioma de la petición (`Accept-Language`).
 *   Los catálogos los vuelve a pedir `CatalogProvider`. Nada se recarga: la pantalla sigue igual.
 */
export function LocaleSync() {
  const { user, refreshUser } = useAuth();
  const feedback = useFeedback();
  const locale = useLocale();
  const preferred = user?.preferences?.locale;
  const signedIn = user !== null;

  useEffect(() => {
    if (!isLocale(preferred) || preferred === currentLocale()) return;
    setLocale(preferred).then(
      () => rememberDeviceLocale(preferred),
      (error: unknown) => void feedback.fromError(error, { title: () => t('language.loadFailed') }),
    );
  }, [preferred, feedback]);

  const shown = useRef(locale);
  useEffect(() => {
    if (shown.current === locale) return;
    shown.current = locale;
    // Accesorio: si falla, el menú conserva sus nombres hasta la siguiente consulta del usuario (un
    // 401 ya lo atiende apiClient); la pantalla y lo que la persona hacía no se tocan.
    if (signedIn) refreshUser().catch(() => undefined);
  }, [locale, signedIn, refreshUser]);

  return null;
}
