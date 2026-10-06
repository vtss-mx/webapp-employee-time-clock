import { Ban, LogIn } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppErrorScreen } from '../components/AppErrorScreen';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import { paths } from './paths';

/**
 * Empresa suspendida en la plataforma (cobranza): el backend responde COMPANY_SUSPENDED (403 al entrar
 * o en cualquier petición; 401 si la sesión se cerró al suspenderla) y la app deja de mostrarse. En su
 * lugar, a pantalla completa con la marca: "Tu empresa está suspendida", el mensaje del servidor y a
 * quién acudir. "Volver al inicio de sesión" cierra la sesión local (de mejor esfuerzo en el servidor)
 * y regresa al login sin otro aviso: esta pantalla ya lo explicó.
 */
export function SuspensionGate({ children }: { children: ReactNode }) {
  const t = useT();
  const { suspension, dismissSuspension } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  if (!suspension) return <>{children}</>;

  const exit = async () => {
    setLeaving(true);
    await dismissSuspension();
    // La compuerta sigue montada (ahora muestra la app): el botón se libera para una próxima vez.
    setLeaving(false);
    void navigate(paths.login, { replace: true });
  };

  return (
    <AppErrorScreen
      badge={
        <>
          <Ban size={14} aria-hidden /> {t('auth.suspension.badge')}
        </>
      }
      title={t('auth.suspension.title')}
      message={suspension.message}
      footnote={t('auth.suspension.footnote')}
      retryLabel={t('auth.suspension.exit')}
      actionIcon={<LogIn size={18} />}
      busy={leaving}
      onRetry={() => void exit()}
    />
  );
}
