import { Languages, LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../components/ui/Panel';
import { ChangePasswordSection } from '../components/ChangePasswordSection';
import { ConsentsSection } from '../components/consents/ConsentsSection';
import { EmployeeDevices } from '../components/devices/EmployeeDevices';
import { ProfilePhotoSection } from '../components/ProfilePhotoSection';
import { Avatar } from '../components/ui/Avatar';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { DataExportSection } from '../components/dataExport/DataExportSection';
import { PasskeysSection } from '../components/passkeys/PasskeysSection';
import { SessionsPanel } from '../components/SessionsPanel';
import { FaceStatusBadge, StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useCatalogs } from '../hooks/useCatalogs';
import { useErrorPopup } from '../hooks/useFeedback';
import { employeeDeviceService } from '../services/employeeDeviceService';
import { t, useT } from '../i18n';
import { formatDateTime } from '../utils/format';
import { formatPhone } from '../utils/phone';
import { useConfirmLogout } from '../components/auth/logoutConfirm';

/**
 * Mi perfil: la cuenta, su foto de perfil (de la persona: la ve en el menú y su empresa en sus listas), el idioma
 * de la aplicación (cambia en caliente y se guarda en la cuenta), la contraseña, sus llaves de acceso (WebAuthn), las
 * sesiones abiertas y, si tiene un empleo, los dispositivos desde los que checa (solo lectura: los aprueba o revoca su
 * empresa).
 */
export function ProfilePage() {
  // Redibuja al cambiar el idioma; los textos salen de `t` (también el del popup, que se arma al dibujarse).
  useT();
  const { user, refreshUser } = useAuth();
  const confirmLogout = useConfirmLogout();
  const { nameOf } = useCatalogs();
  const [error, setError] = useState<unknown>(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    refreshUser().catch(setError);
  }, [refreshUser]);
  // Los datos en pantalla son los de la sesión; si no se pudieron actualizar se avisa en el popup.
  useErrorPopup(error, { title: () => t('profile.refreshFailed') });

  if (!user) return null;
  const employee = user.employee;
  const name = employee?.full_name ?? user.email;

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
        <PanelGrid>
          <PanelSection title={t('profile.account.title')} icon={<UserRound size={20} />}>
            <div className="row" style={{ gap: 16 }}>
              <Avatar name={name} src={user.avatar} size="lg" decorative />
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
                <dt>{t('common.fields.email')}</dt>
                <dd>{user.email}</dd>
              </div>
              {employee?.employee_number && (
                <div>
                  <dt>{t('common.fields.employeeNumber')}</dt>
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
                  <dt>{t('common.fields.mobilePhone')}</dt>
                  <dd>{formatPhone(employee.phone)}</dd>
                </div>
              )}
              <div>
                <dt>{t('profile.account.lastLogin')}</dt>
                <dd>{formatDateTime(user.last_login_at)}</dd>
              </div>
              <div>
                <dt>{t('profile.account.createdAt')}</dt>
                <dd>{formatDateTime(user.created_at)}</dd>
              </div>
            </dl>
          </PanelSection>
          <ProfilePhotoSection />
          <ChangePasswordSection onChanged={() => setSessionsVersion((v) => v + 1)} />
          <PanelSection title={t('profile.language.title')} icon={<Languages size={20} />}>
            <LanguageSwitcher />
          </PanelSection>
          <PasskeysSection />
          {employee && <ConsentsSection />}
          {/* Exportar sus datos (RGPD arts. 15 y 20): solo con una empresa en la sesión; sin ella el servidor
              responde 403 COMPANY_REQUIRED (una cuenta de la plataforma no tiene expediente en una empresa). */}
          {user.company && <DataExportSection subject={{ kind: 'mine' }} />}
          {employee && (
            <PanelSection title={t('devices.mineTitle')} icon={<MonitorSmartphone size={20} />}>
              <p className="muted small">{t('devices.mineIntro')}</p>
              <EmployeeDevices filterKey="mine" load={(query, signal) => employeeDeviceService.mine(query, signal)} />
            </PanelSection>
          )}
        </PanelGrid>
        <SessionsPanel key={sessionsVersion} />
        <PanelFooter>
          <Button
            variant="danger-outline"
            size="lg"
            icon={<LogOut size={18} />}
            onClick={() => void confirmLogout()}
          >
            {t('common.actions.logout')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
