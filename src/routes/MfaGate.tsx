import { KeyRound, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppErrorScreen } from '../components/AppErrorScreen';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import { paths } from './paths';

/**
 * Segundo factor obligatorio con la gracia VENCIDA (migración 0096 del backend): el servidor responde 403
 * `MFA_ENROLLMENT_REQUIRED` en TODAS las pantallas y lo único que queda abierto es lo de la cuenta. La app deja de
 * mostrarse y, en su lugar, a pantalla completa con la marca: qué pasa, el mensaje del servidor y la ÚNICA acción
 * que sirve, «Registrar llave de acceso» (nunca un «Reintentar», que volvería a fallar; regla 7 de la raíz).
 *
 * La ruta de registrar la llave pasa SIEMPRE: es donde la persona cumple el requisito (sus peticiones no exigen
 * pantalla, así que no reciben el 403). Al salir de ella con la llave registrada, el servidor apaga la marca de
 * sus sesiones y todo vuelve a responder sin iniciar sesión de nuevo.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const t = useT();
  const { mfaEnrollment, dismissMfaEnrollment } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!mfaEnrollment || pathname === paths.profilePasskeyNew) return <>{children}</>;

  const enroll = () => {
    dismissMfaEnrollment();
    void navigate(paths.profilePasskeyNew);
  };

  return (
    <AppErrorScreen
      badge={
        <>
          <ShieldAlert size={14} aria-hidden /> {t('passkeys.gate.badge')}
        </>
      }
      title={t('passkeys.gate.title')}
      message={mfaEnrollment.message}
      footnote={t('passkeys.gate.footnote')}
      retryLabel={t('passkeys.gate.action')}
      actionIcon={<KeyRound size={18} />}
      onRetry={enroll}
    />
  );
}
