import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { authService } from '../services/authService';

/**
 * "Recordar mi cuenta": el correo recordado en este dispositivo vive en la BD; el navegador solo
 * guarda una cookie HttpOnly opaca. Al cargar el login se consulta una vez.
 */
export function useRememberedAccount(onFound: (email: string) => void) {
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const onFoundRef = useRef(onFound);
  useLayoutEffect(() => {
    onFoundRef.current = onFound;
  });

  useEffect(() => {
    let active = true;
    authService
      .remembered()
      .then((account) => {
        if (!active || !account) return;
        setRememberedEmail(account.email);
        onFoundRef.current(account.email);
      })
      .catch(() => undefined); // sin red: el login funciona igual, solo sin el correo escrito
    return () => {
      active = false;
    };
  }, []);

  /** "Usar otra cuenta": el dispositivo deja de recordarla. */
  const forget = useCallback(async () => {
    await authService.forgetRemembered();
    setRememberedEmail(null);
  }, []);

  return { rememberedEmail, forget };
}
