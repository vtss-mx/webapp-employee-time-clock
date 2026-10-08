import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../hooks/useFeedback';
import { t, useT } from '../../i18n';
import { passkeyService } from '../../services/passkeyService';
import type { User } from '../../types';
import { getPasskey, passkeysSupported } from '../../utils/webauthn';
import { Button } from '../ui/Button';
import type { MessageInput } from '../MessageDialog';
import { loginRuleMessage } from './loginMessages';

interface PasskeyLoginProps {
  remember: boolean;
  disabled: boolean;
  onLoggedIn: (user: User) => void;
  /** El resto del formulario se bloquea mientras el dispositivo responde. */
  onBusy: (busy: boolean) => void;
}

/**
 * «Entrar con llave de acceso» (WebAuthn / passkeys, antifraude fase 3): solo si el navegador las admite
 * (`window.PublicKeyCredential`). Pide el reto sellado, el dispositivo firma (el aviso del sistema pide el rostro, la
 * huella o el PIN) y el servidor emite la MISMA sesión que la contraseña, con las mismas reglas de un validador
 * (dispositivo y ubicación). Cancelar el aviso del sistema no es una falla: no avisa nada.
 */
export function PasskeyLogin({ remember, disabled, onLoggedIn, onBusy }: PasskeyLoginProps) {
  useT();
  const { loginWithPasskey } = useAuth();
  const feedback = useFeedback();
  const [waiting, setWaiting] = useState(false);
  if (!passkeysSupported()) return null;

  const signIn = async () => {
    setWaiting(true);
    onBusy(true);
    try {
      const options = await passkeyService.loginOptions();
      const credential = await getPasskey(options.options);
      if (!credential) return;
      const user = await loginWithPasskey({ token: options.token, credential, remember });
      onLoggedIn(user);
    } catch (err) {
      // Reglas del validador (dispositivo por autorizar, ubicación...): su propio aviso; lo demás, el popup de siempre.
      if (loginRuleMessage(err)) void feedback.show(() => loginRuleMessage(err) as MessageInput);
      else void feedback.fromError(err, { title: () => t('passkeys.login.failed'), showAuthErrors: true });
    } finally {
      setWaiting(false);
      onBusy(false);
    }
  };

  return (
    <>
      <p className="auth-card__divider" aria-hidden>
        {t('passkeys.login.divider')}
      </p>
      <Button variant="secondary" size="lg" block loading={waiting} disabled={disabled} icon={<KeyRound size={20} />} onClick={() => void signIn()}>
        {waiting ? t('passkeys.login.waiting') : t('passkeys.login.button')}
      </Button>
    </>
  );
}
