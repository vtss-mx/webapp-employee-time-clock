import { KeyRound, LogIn, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { loginRuleMessage } from '../components/auth/loginMessages';
import { FormField } from '../components/FormField';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';
import { useRememberedAccount } from '../hooks/useRememberedAccount';
import { isOutdated, reloadApp } from '../services/versionService';
import { config } from '../utils/config';
import { homeForUser, needsCompanySelection } from '../routes/paths';
import { validateEmail } from '../utils/validation';

const REMEMBER_HINT = 'Mantén la sesión abierta en este dispositivo. No la uses en equipos compartidos.';

export function LoginPage() {
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
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Entrar solo con correo válido y contraseña escrita.
  const canSubmit = !validateEmail(email) && Boolean(password);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const feedback = useFeedback();

  // Sesión cerrada por el sistema (expiró, se revocó, se cambió la contraseña): se explica al llegar.
  useEffect(() => {
    if (logoutReason) void feedback.info('Tu sesión terminó', logoutReason, { key: 'logout-reason' });
  }, [logoutReason, feedback]);

  // Con sesión iniciada, GuestOnlyRoute lleva al inicio del rol (no se llega aquí).

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'La contraseña es obligatoria',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      void feedback.invalidForm(nextErrors);
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
      const ruleMessage = loginRuleMessage(err);
      if (ruleMessage) {
        void feedback.show(ruleMessage);
        return;
      }
      // Credenciales o cuenta desactivada (401) sí se muestran aquí; el dispositivo no
      // permitido lo presenta la app con su propio aviso.
      void feedback.fromError(err, { title: 'No se pudo iniciar sesión', showAuthErrors: true });
    }
  };

  const switchAccount = async () => {
    try {
      await forget();
    } catch (err) {
      void feedback.fromError(err, { title: 'No se pudo cambiar de cuenta' });
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
          <h1>Iniciar sesión</h1>
          <p className="muted">Usa tu cuenta corporativa de {config.appName}</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="stack">
          <FormField
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="tu@empresa.com"
            icon={<Mail size={18} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
            }}
            onBlur={() => email && setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
            error={errors.email}
            disabled={loading}
            required
            autoFocus
            inputRef={emailRef}
          />
          {showRemembered && (
            <p className="auth-card__remembered">
              Cuenta recordada en este dispositivo.
              <Button variant="link" size="sm" onClick={() => void switchAccount()} disabled={loading}>
                Usar otra cuenta
              </Button>
            </p>
          )}
          <FormField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<KeyRound size={18} />}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            disabled={loading}
            required
            inputRef={passwordRef}
          />

          <div className="auth-card__options">
            <Checkbox variant="inline" size="sm" label="Recordar mi cuenta" title={REMEMBER_HINT} checked={remember} disabled={loading} onChange={setRemember} aria-describedby="remember-hint" />
          </div>
          <span id="remember-hint" className="sr-only">
            {REMEMBER_HINT}
          </span>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={loading}
            disabled={!canSubmit}
            title={canSubmit ? undefined : 'Escribe tu correo y tu contraseña'}
            icon={<LogIn size={20} />}
          >
            {locating ? 'Verificando tu ubicación...' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
