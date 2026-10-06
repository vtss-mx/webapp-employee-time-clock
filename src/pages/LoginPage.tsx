import { KeyRound, LogIn, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { loginRuleMessage } from '../components/auth/loginMessages';
import { FormField } from '../components/FormField';
import type { MessageInput } from '../components/MessageDialog';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';
import { useRememberedAccount } from '../hooks/useRememberedAccount';
import { t, useT } from '../i18n';
import { isOutdated, reloadApp } from '../services/versionService';
import { config } from '../utils/config';
import { homeForUser, needsCompanySelection } from '../routes/paths';
import { validateEmail } from '../utils/validation';

/** Qué falta para entrar, con los mensajes en el idioma activo (se calculan al dibujarse). */
function loginErrors(email: string, password: string) {
  return { email: validateEmail(email), password: password ? undefined : t('auth.login.passwordRequired') };
}

export function LoginPage() {
  // Redibuja al cambiar el idioma (sin perder lo escrito). Los textos salen de `t`, también los de los
  // popups, que se arman al dibujarse.
  useT();
  const { login, logoutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Cuenta recordada en este dispositivo (dato en la BD): correo escrito, casilla marcada y foco en la contraseña.
  const { rememberedEmail, forget } = useRememberedAccount((found) => {
    setEmail((current) => current || found);
    setRemember(true);
    passwordRef.current?.focus();
  });
  const showRemembered = Boolean(rememberedEmail) && email.trim().toLowerCase() === rememberedEmail;
  // Qué errores se muestran (no su texto: se calcula al dibujar, en el idioma activo).
  const [shown, setShown] = useState({ email: false, password: false });
  const live = loginErrors(email, password);
  const errors = { email: shown.email ? live.email : undefined, password: shown.password ? live.password : undefined };
  const showEmailError = (value: string) => setShown((prev) => ({ ...prev, email: Boolean(validateEmail(value)) }));
  // Entrar solo con correo válido y contraseña escrita.
  const canSubmit = !live.email && !live.password;
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const feedback = useFeedback();

  // Sesión cerrada por el sistema (expiró, se revocó, se cambió la contraseña): se explica al llegar.
  useEffect(() => {
    if (logoutReason) void feedback.info(() => t('auth.login.sessionEnded'), logoutReason, { key: 'logout-reason' });
  }, [logoutReason, feedback]);

  // Con sesión iniciada, GuestOnlyRoute lleva al inicio del rol (no se llega aquí).

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const invalid = { email: Boolean(live.email), password: Boolean(live.password) };
    setShown(invalid);
    if (invalid.email || invalid.password) {
      void feedback.invalidForm(() => loginErrors(email, password));
      return;
    }

    setLoading(true);
    // Si se publicó una versión nueva, se carga antes de entrar (nunca se inicia sesión con
    // código anterior en una pestaña que quedó abierta).
    if (await isOutdated()) {
      reloadApp();
      return;
    }
    try {
      // El servidor recuerda (o deja de recordar) la cuenta en este dispositivo según la casilla.
      const loggedUser = await login(email, password, remember, { onLocating: () => setLocating(true) });
      const from = (location.state as { from?: string } | null)?.from;
      const home = homeForUser(loggedUser);
      const resume = !needsCompanySelection(loggedUser) && from?.startsWith(home.split('/').slice(0, 2).join('/'));
      void navigate(resume && from ? from : home, { replace: true });
    } catch (err) {
      setLoading(false);
      setLocating(false);
      // Reglas del validador (dispositivo por autorizar, ubicación...): su propio aviso.
      if (loginRuleMessage(err)) {
        // Se arma al dibujarse: con el aviso abierto, un cambio de idioma lo traduce.
        void feedback.show(() => loginRuleMessage(err) as MessageInput);
        return;
      }
      // Credenciales o cuenta desactivada (401) sí se muestran aquí; el dispositivo no
      // permitido lo presenta la app con su propio aviso.
      void feedback.fromError(err, { title: () => t('auth.login.failed'), showAuthErrors: true });
    }
  };

  const switchAccount = async () => {
    try {
      await forget();
    } catch (err) {
      void feedback.fromError(err, { title: () => t('auth.login.switchFailed') });
      return;
    }
    setEmail('');
    setPassword('');
    setRemember(false);
    emailRef.current?.focus();
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card__head">
          <BrandLogo size={76} />
          <h1>{t('auth.login.title')}</h1>
          <p className="muted">{t('auth.login.subtitle', { app: config.appName })}</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="stack">
          <FormField
            label={t('common.fields.email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder={t('auth.login.emailPlaceholder')}
            icon={<Mail size={18} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) showEmailError(e.target.value);
            }}
            onBlur={() => email && showEmailError(email)}
            error={errors.email}
            disabled={loading}
            required
            autoFocus
            inputRef={emailRef}
          />
          {showRemembered && (
            <p className="auth-card__remembered">
              {t('auth.login.remembered')}
              <Button variant="link" size="sm" onClick={() => void switchAccount()} disabled={loading}>
                {t('auth.login.useOtherAccount')}
              </Button>
            </p>
          )}
          <FormField
            label={t('auth.login.password')}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<KeyRound size={18} />}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setShown((prev) => ({ ...prev, password: false }));
            }}
            error={errors.password}
            disabled={loading}
            required
            inputRef={passwordRef}
          />

          <div className="auth-card__options">
            <Checkbox variant="inline" size="sm" label={t('auth.login.remember')} title={t('auth.login.rememberHint')} checked={remember} disabled={loading} onChange={setRemember} aria-describedby="remember-hint" />
          </div>
          <span id="remember-hint" className="sr-only">
            {t('auth.login.rememberHint')}
          </span>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={loading}
            disabled={!canSubmit}
            title={canSubmit ? undefined : t('auth.login.submitDisabled')}
            icon={<LogIn size={20} />}
          >
            {locating ? t('auth.login.locating') : t('auth.login.submit')}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
