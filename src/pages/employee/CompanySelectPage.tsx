import { ChevronRight, Loader2, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { homeForUser } from '../../routes/paths';
import type { UserMembership } from '../../types';
import { useConfirmLogout } from '../../components/auth/logoutConfirm';

function unavailableReason(membership: UserMembership): string | null {
  if (!membership.company.active) return 'Empresa desactivada';
  return membership.active ? null : 'Tu acceso está desactivado';
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

/** Empleado que trabaja en varias empresas: elige a cuál entrar (o cambia de empresa). */
export function CompanySelectPage() {
  const { user, selectCompany } = useAuth();
  const confirmLogout = useConfirmLogout();
  const { byCode } = useCatalogs();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [entering, setEntering] = useState<number | null>(null);
  if (!user) return null;
  const memberships = user.memberships ?? [];

  const enter = async (membership: UserMembership) => {
    setEntering(membership.company.id);
    try {
      const updated = await selectCompany(membership.company.id);
      void navigate(homeForUser(updated), { replace: true });
    } catch (err) {
      setEntering(null);
      void feedback.fromError(err, { title: `No se pudo entrar a ${membership.company.name}` });
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card company-select">
        <div className="auth-card__head">
          <BrandLogo size={64} />
          <h1>Elige tu empresa</h1>
          <p className="muted">
            Trabajas en {memberships.length} empresas con la cuenta <strong>{user.email}</strong>.
          </p>
        </div>

        <ul className="company-select__list stagger">
          {memberships.map((membership) => {
            const reason = unavailableReason(membership);
            const current = user.company?.id === membership.company.id;
            // Qué le espera en cada empresa (cada una valida su identidad por separado).
            const faceNote = byCode('face_statuses', membership.face_status)?.employee_note ?? membership.face_status;
            return (
              <li key={membership.id}>
                <button
                  type="button"
                  className={`company-select__item ${current ? 'is-current' : ''}`}
                  disabled={Boolean(reason) || entering !== null}
                  aria-current={current || undefined}
                  onClick={() => void enter(membership)}
                >
                  <span className="company-row__logo" aria-hidden>
                    {initialsOf(membership.company.name)}
                  </span>
                  <span className="company-select__info">
                    <strong>{membership.company.name}</strong>
                    <small>{reason ?? (current ? `Empresa actual · ${faceNote}` : faceNote)}</small>
                  </span>
                  {entering === membership.company.id ? (
                    <Loader2 size={20} className="spin" aria-label="Entrando" />
                  ) : (
                    <ChevronRight size={20} aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void confirmLogout()} disabled={entering !== null}>
          Cerrar sesión
        </Button>
      </div>
    </AuthLayout>
  );
}
