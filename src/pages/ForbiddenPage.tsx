import { Home, ShieldAlert } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { homeForUser, paths } from '../routes/paths';

export function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <div className="center-page page-transition">
      <span className="icon-tile icon-tile--lg icon-tile--danger">
        <ShieldAlert size={32} />
      </span>
      <div className="center-page__code">403</div>
      <h1>Acceso denegado</h1>
      <p className="muted">No tienes permisos para acceder a esta sección.</p>
      <ButtonLink to={user ? homeForUser(user) : paths.login} variant="primary" size="lg" icon={<Home size={18} />}>
        Ir al inicio
      </ButtonLink>
    </div>
  );
}
