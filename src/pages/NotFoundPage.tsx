import { Compass, Home } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { homeForUser, paths } from '../routes/paths';

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="center-page page-transition">
      <span className="icon-tile icon-tile--lg">
        <Compass size={32} />
      </span>
      <div className="center-page__code">404</div>
      <h1>Página no encontrada</h1>
      <p className="muted">La página que buscas no existe o fue movida.</p>
      <ButtonLink to={user ? homeForUser(user) : paths.login} variant="primary" size="lg" icon={<Home size={18} />}>
        Ir al inicio
      </ButtonLink>
    </div>
  );
}
