import { Home } from 'lucide-react';
import type { ReactNode } from 'react';
import { ButtonLink } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import { homeForUser, paths } from '../routes/paths';

interface SystemStatusPageProps {
  /** Código HTTP que se muestra grande (403, 404). */
  code: string;
  icon: ReactNode;
  /** Tono del ícono: `danger` para un acceso negado. */
  tone?: 'neutral' | 'danger';
  title: string;
  text: string;
}

/**
 * Pantalla del sistema (sin permiso, no encontrada): código, qué pasó y "Ir al inicio" (el inicio que
 * el backend dio a la persona o, sin sesión, el inicio de sesión). Los textos llegan ya traducidos
 * de quien la usa, que se redibuja al cambiar el idioma.
 */
export function SystemStatusPage({ code, icon, tone = 'neutral', title, text }: SystemStatusPageProps) {
  const { user } = useAuth();
  const t = useT();
  return (
    <div className="center-page page-transition">
      <span className={`icon-tile icon-tile--lg ${tone === 'danger' ? 'icon-tile--danger' : ''}`.trim()}>{icon}</span>
      <div className="center-page__code">{code}</div>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <ButtonLink to={user ? homeForUser(user) : paths.login} variant="primary" size="lg" icon={<Home size={18} />}>
        {t('system.goHome')}
      </ButtonLink>
    </div>
  );
}
