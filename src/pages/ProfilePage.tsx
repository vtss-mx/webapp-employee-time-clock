import { LogOut, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../components/ui/Panel';
import { ChangePasswordSection } from '../components/ChangePasswordSection';
import { SessionsPanel } from '../components/SessionsPanel';
import { FaceStatusBadge, StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useCatalogs } from '../hooks/useCatalogs';
import { useErrorPopup } from '../hooks/useFeedback';
import { formatDateTime, initials } from '../utils/format';
import { formatPhone } from '../utils/phone';

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const { nameOf } = useCatalogs();
  const [error, setError] = useState<unknown>(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    refreshUser().catch(setError);
  }, [refreshUser]);
  // Los datos en pantalla son los de la sesión; si no se pudieron actualizar se avisa en el popup.
  useErrorPopup(error, { title: 'No se pudo actualizar tu información' });

  if (!user) return null;
  const employee = user.employee;
  const name = employee?.full_name ?? user.email;

  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Mi perfil" subtitle="Tu cuenta, tu contraseña y los dispositivos con sesión iniciada" />
        <PanelGrid>
          <PanelSection title="Cuenta" icon={<UserRound size={20} />}>
            <div className="row" style={{ gap: 16 }}>
              <span className="avatar avatar--lg">{initials(name)}</span>
              <div className="stack" style={{ gap: 6 }}>
                <h2>{name}</h2>
                <div className="row">
                  <span className="badge badge--info">{nameOf('roles', user.role)}</span>
                  <StatusBadge active={user.active} />
                  {employee && <FaceStatusBadge status={employee.face_status} />}
                </div>
              </div>
            </div>
            <dl className="details">
              <div>
                <dt>Correo electrónico</dt>
                <dd>{user.email}</dd>
              </div>
              {employee && (
                <div>
                  <dt>Número de empleado</dt>
                  <dd>{employee.employee_number}</dd>
                </div>
              )}
              {employee?.curp && (
                <div>
                  <dt>CURP</dt>
                  <dd>{employee.curp}</dd>
                </div>
              )}
              {employee?.rfc && (
                <div>
                  <dt>RFC</dt>
                  <dd>{employee.rfc}</dd>
                </div>
              )}
              {employee?.nss && (
                <div>
                  <dt>NSS</dt>
                  <dd>{employee.nss}</dd>
                </div>
              )}
              {employee?.phone && (
                <div>
                  <dt>Teléfono celular</dt>
                  <dd>{formatPhone(employee.phone)}</dd>
                </div>
              )}
              <div>
                <dt>Último inicio de sesión</dt>
                <dd>{formatDateTime(user.last_login_at)}</dd>
              </div>
              <div>
                <dt>Cuenta creada</dt>
                <dd>{formatDateTime(user.created_at)}</dd>
              </div>
            </dl>
          </PanelSection>
          <ChangePasswordSection onChanged={() => setSessionsVersion((v) => v + 1)} />
        </PanelGrid>
        <SessionsPanel key={sessionsVersion} />
        <PanelFooter>
          <Button
            variant="danger-outline"
            size="lg"
            icon={<LogOut size={18} />}
            onClick={() => void logout('Cerraste sesión. Tu token de acceso ya no es válido.')}
          >
            Cerrar sesión
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
